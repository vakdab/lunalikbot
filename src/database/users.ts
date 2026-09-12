import { D1Client } from './d1';
import { KVStorage } from './kv';
import { UserProfile } from './types';
import { TelegramUser } from '../telegram/types';
import { Logger } from '../utils/logger';

export class UserRepository {
  constructor(
    private readonly d1: D1Client,
    private readonly kv: KVStorage
  ) {}

  private calculateTier(points: number): UserProfile['relationshipTier'] {
    if (points >= 500) return 'soulmate';
    if (points >= 250) return 'close_friend';
    if (points >= 100) return 'friend';
    if (points >= 30) return 'acquaintance';
    return 'stranger';
  }

  async getOrCreate(tgUser: TelegramUser): Promise<UserProfile> {
    const cacheKey = `user:${tgUser.id}`;
    const cached = await this.kv.get<UserProfile>(cacheKey);
    if (cached) {
      return cached;
    }

    if (this.d1.isAvailable) {
      try {
        const row = await this.d1.first<any>(
          'SELECT * FROM users WHERE id = ?',
          tgUser.id
        );

        if (row) {
          const profile: UserProfile = {
            id: row.id,
            firstName: row.first_name,
            lastName: row.last_name || undefined,
            username: row.username || undefined,
            languageCode: row.language_code || 'uk',
            createdAt: row.created_at,
            lastActiveAt: Date.now(),
            messageCount: row.message_count + 1,
            relationshipPoints: row.relationship_points,
            relationshipTier: row.relationship_tier,
            isBanned: Boolean(row.is_banned),
            rouletteStats: {
              totalChats: row.roulette_chats || 0,
              rating: 5.0,
              reportsCount: row.roulette_reports || 0,
            },
          };

          // Update last active
          await this.d1.run(
            'UPDATE users SET last_active_at = ?, message_count = message_count + 1 WHERE id = ?',
            profile.lastActiveAt,
            profile.id
          );

          await this.kv.set(cacheKey, profile, 600); // 10 min cache
          return profile;
        }

        // Create new user in D1
        const now = Date.now();
        await this.d1.run(
          `INSERT INTO users (id, first_name, last_name, username, language_code, created_at, last_active_at, message_count, relationship_points, relationship_tier, is_banned, roulette_chats, roulette_reports)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 'stranger', 0, 0, 0)`,
          tgUser.id,
          tgUser.first_name,
          tgUser.last_name || null,
          tgUser.username || null,
          tgUser.language_code || 'uk',
          now,
          now
        );

        const newProfile: UserProfile = {
          id: tgUser.id,
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
          username: tgUser.username,
          languageCode: tgUser.language_code || 'uk',
          createdAt: now,
          lastActiveAt: now,
          messageCount: 1,
          relationshipPoints: 0,
          relationshipTier: 'stranger',
          isBanned: false,
          rouletteStats: {
            totalChats: 0,
            rating: 5.0,
            reportsCount: 0,
          },
        };

        await this.kv.set(cacheKey, newProfile, 600);
        return newProfile;
      } catch (err) {
        Logger.error(`Database error getting user ${tgUser.id}`, err);
      }
    }

    // KV / In-memory fallback
    const fallbackProfile: UserProfile = {
      id: tgUser.id,
      firstName: tgUser.first_name,
      lastName: tgUser.last_name,
      username: tgUser.username,
      languageCode: tgUser.language_code || 'uk',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      messageCount: 1,
      relationshipPoints: 5,
      relationshipTier: 'stranger',
      isBanned: false,
      rouletteStats: { totalChats: 0, rating: 5.0, reportsCount: 0 },
    };

    await this.kv.set(cacheKey, fallbackProfile, 3600);
    return fallbackProfile;
  }

  async addRelationshipPoints(userId: number, pointsToAdd: number): Promise<UserProfile | null> {
    const cacheKey = `user:${userId}`;
    const user = await this.kv.get<UserProfile>(cacheKey);
    if (!user) return null;

    user.relationshipPoints = Math.max(0, user.relationshipPoints + pointsToAdd);
    user.relationshipTier = this.calculateTier(user.relationshipPoints);

    if (this.d1.isAvailable) {
      try {
        await this.d1.run(
          'UPDATE users SET relationship_points = ?, relationship_tier = ? WHERE id = ?',
          user.relationshipPoints,
          user.relationshipTier,
          userId
        );
      } catch (err) {
        Logger.error(`Error updating relationship points for user ${userId}`, err);
      }
    }

    await this.kv.set(cacheKey, user, 600);
    return user;
  }
}
