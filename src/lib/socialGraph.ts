import {
  ActivityEvent,
  CreatorProfileData,
  UserAccount,
  VideoPost,
} from '../types';
import {
  adjustCreatorFollowerDelta,
  getStoredFollowedUsernames,
  normalizeCreatorUsername,
  saveStoredFollowedUsernames,
  CREATOR_DIRECTORY_CACHE_KEY,
} from './supabaseService';

export const SOCIAL_EDGES_KEY = 'jatt_social_follow_edges_v1';
export const SOCIAL_MIGRATED_ACTORS_KEY = 'jatt_social_migrated_actors_v1';
export const SOCIAL_SUPPRESSED_FOLLOWERS_KEY = 'jatt_social_suppressed_followers_v1';

export type SocialEdgesMap = Record<string, string[]>;

export interface SocialRelationshipStatus {
  isFollowing: boolean;
  isFollower: boolean;
  isMutualFriend: boolean;
}

export interface SocialMemberProfile {
  username: string;
  name: string;
  avatar: string;
  bio: string;
  isVerified: boolean;
  isFollowing: boolean;
  isFollower: boolean;
  isMutualFriend: boolean;
}

function cleanHandle(raw?: string | null): string {
  if (!raw) return '';
  return normalizeCreatorUsername(raw) || raw.trim().replace(/^@+/, '').toLowerCase();
}

function readEdgesMapRaw(): SocialEdgesMap {
  try {
    const raw = localStorage.getItem(SOCIAL_EDGES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const normalized: SocialEdgesMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      const cleanKey = cleanHandle(k);
      if (!cleanKey || !Array.isArray(v)) continue;
      normalized[cleanKey] = Array.from(
        new Set(v.map((item) => cleanHandle(String(item))).filter((x) => x && x !== cleanKey))
      );
    }
    return normalized;
  } catch {
    return {};
  }
}

function writeEdgesMapRaw(map: SocialEdgesMap): void {
  try {
    localStorage.setItem(SOCIAL_EDGES_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

function readStringArrayMap(key: string): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const ck = cleanHandle(k);
      if (!ck || !Array.isArray(v)) continue;
      out[ck] = Array.from(new Set(v.map((x) => cleanHandle(String(x))).filter(Boolean)));
    }
    return out;
  } catch {
    return {};
  }
}

function writeStringArrayMap(key: string, map: Record<string, string[]>): void {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function readMigratedActorsSet(): Set<string> {
  try {
    const raw = localStorage.getItem(SOCIAL_MIGRATED_ACTORS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map((x) => cleanHandle(String(x))).filter(Boolean)) : new Set();
  } catch {
    return new Set();
  }
}

function markActorMigrated(actorClean: string): void {
  if (!actorClean) return;
  try {
    const set = readMigratedActorsSet();
    if (!set.has(actorClean)) {
      set.add(actorClean);
      localStorage.setItem(SOCIAL_MIGRATED_ACTORS_KEY, JSON.stringify(Array.from(set)));
    }
  } catch {
    // ignore
  }
}

function isSuppressedPair(
  suppressedMap: Record<string, string[]>,
  ownerClean: string,
  followerClean: string
): boolean {
  const list = suppressedMap[ownerClean];
  return Boolean(list && list.includes(followerClean));
}

/**
 * Builds the live directional follow graph while preserving all legacy
 * `jatt_followed_usernames` data and ingesting real `follow` activity events.
 */
export function buildMergedSocialEdges(
  activeUsername?: string,
  activityEvents: ActivityEvent[] = []
): SocialEdgesMap {
  const map = readEdgesMapRaw();
  const cleanActive = cleanHandle(activeUsername);
  let mutated = false;

  // One-time non-destructive migration of legacy `jatt_followed_usernames` into the active user's edges
  if (cleanActive) {
    const migrated = readMigratedActorsSet();
    if (!migrated.has(cleanActive)) {
      const legacyFollowed = getStoredFollowedUsernames();
      const existing = new Set(map[cleanActive] || []);
      let addedAny = false;
      legacyFollowed.forEach((rawTarget) => {
        const targetClean = cleanHandle(rawTarget);
        if (targetClean && targetClean !== cleanActive && !existing.has(targetClean)) {
          existing.add(targetClean);
          addedAny = true;
        }
      });
      if (addedAny || !map[cleanActive]) {
        map[cleanActive] = Array.from(existing);
        mutated = true;
      }
      markActorMigrated(cleanActive);
    }
  }

  // Merge real incoming 'follow' activity events (excluding explicitly removed friends)
  if (activityEvents.length > 0) {
    const suppressed = readStringArrayMap(SOCIAL_SUPPRESSED_FOLLOWERS_KEY);
    for (const ev of activityEvents) {
      if (ev.type !== 'follow') continue;
      const actor = cleanHandle(ev.actorUsername);
      const target = cleanHandle(ev.postOwnerUsername);
      if (!actor || !target || actor === target) continue;
      if (isSuppressedPair(suppressed, target, actor)) continue;
      const list = map[actor] || [];
      if (!list.includes(target)) {
        map[actor] = [...list, target];
        mutated = true;
      }
    }
  }

  if (mutated) {
    writeEdgesMapRaw(map);
  }

  return map;
}

export function getFollowingList(username: string, edges: SocialEdgesMap): string[] {
  const clean = cleanHandle(username);
  if (!clean) return [];
  return edges[clean] || [];
}

export function getFollowersList(username: string, edges: SocialEdgesMap): string[] {
  const clean = cleanHandle(username);
  if (!clean) return [];
  const followers: string[] = [];
  for (const [actor, targets] of Object.entries(edges)) {
    if (actor === clean) continue;
    if (targets.includes(clean)) {
      followers.push(actor);
    }
  }
  return followers;
}

export function getMutualFriendsList(username: string, edges: SocialEdgesMap): string[] {
  const clean = cleanHandle(username);
  if (!clean) return [];
  const following = new Set(getFollowingList(clean, edges));
  const followers = getFollowersList(clean, edges);
  return followers.filter((f) => following.has(f));
}

export function getFollowRelationship(
  viewerUsername: string,
  targetUsername: string,
  edges: SocialEdgesMap
): SocialRelationshipStatus {
  const viewer = cleanHandle(viewerUsername);
  const target = cleanHandle(targetUsername);
  if (!viewer || !target || viewer === target) {
    return { isFollowing: false, isFollower: false, isMutualFriend: false };
  }
  const isFollowing = (edges[viewer] || []).includes(target);
  const isFollower = (edges[target] || []).includes(viewer);
  return {
    isFollowing,
    isFollower,
    isMutualFriend: isFollowing && isFollower,
  };
}

function syncLegacyFollowedSet(activeUsername: string, targetList: string[]): void {
  const legacySet = getStoredFollowedUsernames();
  // Remove entries matching normalized targets that are no longer followed, and add current targets
  const normalizedTargetSet = new Set(targetList.map((t) => cleanHandle(t)));
  const nextSet = new Set<string>();
  legacySet.forEach((raw) => {
    const clean = cleanHandle(raw);
    if (clean && normalizedTargetSet.has(clean)) {
      nextSet.add(raw);
    }
  });
  for (const t of targetList) {
    const hasMatch = Array.from(nextSet).some((x) => cleanHandle(x) === t);
    if (!hasMatch) {
      nextSet.add(t);
    }
  }
  if (activeUsername) {
    saveStoredFollowedUsernames(nextSet);
  }
}

export function toggleFollowInSocialGraph(
  actorUsername: string,
  targetUsername: string,
  activityEvents: ActivityEvent[] = []
): {
  isFollowing: boolean;
  isMutualFriend: boolean;
  edges: SocialEdgesMap;
} {
  const actor = cleanHandle(actorUsername);
  const target = cleanHandle(targetUsername);
  const edges = buildMergedSocialEdges(actor, activityEvents);

  if (!actor || !target || actor === target) {
    return { isFollowing: false, isMutualFriend: false, edges };
  }

  markActorMigrated(actor);
  const currentList = new Set(edges[actor] || []);
  const wasFollowing = currentList.has(target);

  if (wasFollowing) {
    currentList.delete(target);
  } else {
    currentList.add(target);
  }

  edges[actor] = Array.from(currentList);
  writeEdgesMapRaw(edges);
  syncLegacyFollowedSet(actor, edges[actor]);
  adjustCreatorFollowerDelta(target, wasFollowing ? -1 : 1);

  const isFollowingNow = !wasFollowing;
  const isFollowerBack = (edges[target] || []).includes(actor);
  return {
    isFollowing: isFollowingNow,
    isMutualFriend: isFollowingNow && isFollowerBack,
    edges,
  };
}

export function removeFriendInSocialGraph(
  actorUsername: string,
  friendUsername: string,
  activityEvents: ActivityEvent[] = []
): SocialEdgesMap {
  const actor = cleanHandle(actorUsername);
  const friend = cleanHandle(friendUsername);
  const edges = buildMergedSocialEdges(actor, activityEvents);

  if (!actor || !friend || actor === friend) {
    return edges;
  }

  markActorMigrated(actor);
  const actorFollowing = new Set(edges[actor] || []);
  const wasFollowing = actorFollowing.delete(friend);
  edges[actor] = Array.from(actorFollowing);

  const friendFollowing = new Set(edges[friend] || []);
  friendFollowing.delete(actor);
  edges[friend] = Array.from(friendFollowing);

  writeEdgesMapRaw(edges);
  syncLegacyFollowedSet(actor, edges[actor]);
  if (wasFollowing) {
    adjustCreatorFollowerDelta(friend, -1);
  }

  // Record suppression so historical 'follow' activity events don't re-add removed friend
  const suppressed = readStringArrayMap(SOCIAL_SUPPRESSED_FOLLOWERS_KEY);
  const actorSuppressed = new Set(suppressed[actor] || []);
  actorSuppressed.add(friend);
  suppressed[actor] = Array.from(actorSuppressed);
  writeStringArrayMap(SOCIAL_SUPPRESSED_FOLLOWERS_KEY, suppressed);

  return edges;
}

export function resolveSocialMemberProfiles(
  usernames: string[],
  viewerUsername: string,
  edges: SocialEdgesMap,
  users: UserAccount[] = [],
  videos: VideoPost[] = [],
  ownProfile?: CreatorProfileData
): SocialMemberProfile[] {
  const cleanViewer = cleanHandle(viewerUsername);
  const profileMap = new Map<
    string,
    { name: string; avatar: string; bio: string; isVerified: boolean; username: string }
  >();

  // 1. Seed from local creator directory cache
  try {
    const rawDir = localStorage.getItem(CREATOR_DIRECTORY_CACHE_KEY);
    if (rawDir) {
      const parsed = JSON.parse(rawDir);
      if (Array.isArray(parsed)) {
        for (const p of parsed as CreatorProfileData[]) {
          const ch = cleanHandle(p?.username);
          if (!ch) continue;
          profileMap.set(ch, {
            username: p.username || ch,
            name: p.name || ch,
            avatar: p.avatar || '',
            bio: p.bio || '',
            isVerified: Boolean(p.isVerified),
          });
        }
      }
    }
  } catch {
    // ignore
  }

  // 2. Seed from video posts
  for (const v of videos) {
    const ch = cleanHandle(v.creator.username);
    if (!ch) continue;
    const existing = profileMap.get(ch);
    profileMap.set(ch, {
      username: v.creator.username || ch,
      name: v.creator.name || existing?.name || ch,
      avatar: v.creator.avatar || existing?.avatar || '',
      bio: v.creator.bio || existing?.bio || '',
      isVerified: Boolean(v.creator.isVerified || existing?.isVerified),
    });
  }

  // 3. Seed from registered users (authoritative display name & avatar)
  for (const u of users) {
    const ch = cleanHandle(u.username);
    if (!ch) continue;
    const existing = profileMap.get(ch);
    profileMap.set(ch, {
      username: u.username || ch,
      name: u.name || existing?.name || ch,
      avatar: u.avatar || existing?.avatar || '',
      bio: u.bio || existing?.bio || '',
      isVerified: u.role === 'admin' || u.role === 'creator' || Boolean(existing?.isVerified),
    });
  }

  // 4. Own profile override
  if (ownProfile) {
    const ch = cleanHandle(ownProfile.username);
    if (ch) {
      profileMap.set(ch, {
        username: ownProfile.username,
        name: ownProfile.name,
        avatar: ownProfile.avatar,
        bio: ownProfile.bio,
        isVerified: true,
      });
    }
  }

  const uniqueClean = Array.from(
    new Set(usernames.map((u) => cleanHandle(u)).filter((u) => u && u !== cleanViewer))
  );

  return uniqueClean.map((ch) => {
    const meta = profileMap.get(ch);
    const rel = getFollowRelationship(cleanViewer, ch, edges);
    return {
      username: meta?.username || ch,
      name: meta?.name || ch,
      avatar:
        meta?.avatar ||
        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(ch)}&backgroundColor=ec4899`,
      bio: meta?.bio || 'Creator on Jatt VibeReels',
      isVerified: Boolean(meta?.isVerified),
      isFollowing: rel.isFollowing,
      isFollower: rel.isFollower,
      isMutualFriend: rel.isMutualFriend,
    };
  });
}
