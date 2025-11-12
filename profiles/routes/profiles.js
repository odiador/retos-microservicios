import { Hono } from 'hono'
import db from '../db.js'
import logger from '../logger.js'
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js'

const profiles = new Hono()

/**
 * GET /profiles/me - Obtener el perfil del usuario autenticado
 */
profiles.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId')

  try {
    const result = await db(
      `SELECT 
        up.*,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.phone
      FROM profiles.user_profiles up
      INNER JOIN auth.users u ON up.user_id = u.id
      WHERE up.user_id = $1`,
      [userId]
    )

    if (result.rows.length === 0) {
      // Create default profile if doesn't exist
      const newProfile = await db(
        `INSERT INTO profiles.user_profiles (user_id) 
         VALUES ($1) 
         RETURNING *`,
        [userId]
      )

      const userInfo = await db(
        `SELECT username, email, first_name, last_name, phone 
         FROM auth.users WHERE id = $1`,
        [userId]
      )

      logger.info('Created new profile for user', { userId })

      return c.json({
        ...newProfile.rows[0],
        ...userInfo.rows[0]
      })
    }

    return c.json(result.rows[0])
  } catch (error) {
    logger.error('Error fetching user profile', { userId, error: error.message })
    return c.json({ error: 'Error al obtener perfil' }, 500)
  }
})

/**
 * PUT /profiles/me - Actualizar el perfil del usuario autenticado
 */
profiles.put('/me', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()

  const {
    nickname,
    personal_url,
    bio,
    organization,
    country,
    mailing_address,
    contact_info_public,
    profile_visibility,
    github_url,
    linkedin_url,
    twitter_url,
    facebook_url,
    instagram_url,
    website_url
  } = body

  try {
    // Check if profile exists
    const existing = await db(
      'SELECT id FROM profiles.user_profiles WHERE user_id = $1',
      [userId]
    )

    let result

    if (existing.rows.length === 0) {
      // Create new profile
      result = await db(
        `INSERT INTO profiles.user_profiles (
          user_id, nickname, personal_url, bio, organization, country,
          mailing_address, contact_info_public, profile_visibility,
          github_url, linkedin_url, twitter_url, facebook_url, instagram_url, website_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        [
          userId, nickname, personal_url, bio, organization, country,
          mailing_address, contact_info_public, profile_visibility,
          github_url, linkedin_url, twitter_url, facebook_url, instagram_url, website_url
        ]
      )

      logger.info('Profile created', { userId })
    } else {
      // Update existing profile
      result = await db(
        `UPDATE profiles.user_profiles 
        SET 
          nickname = COALESCE($2, nickname),
          personal_url = COALESCE($3, personal_url),
          bio = COALESCE($4, bio),
          organization = COALESCE($5, organization),
          country = COALESCE($6, country),
          mailing_address = COALESCE($7, mailing_address),
          contact_info_public = COALESCE($8, contact_info_public),
          profile_visibility = COALESCE($9, profile_visibility),
          github_url = COALESCE($10, github_url),
          linkedin_url = COALESCE($11, linkedin_url),
          twitter_url = COALESCE($12, twitter_url),
          facebook_url = COALESCE($13, facebook_url),
          instagram_url = COALESCE($14, instagram_url),
          website_url = COALESCE($15, website_url)
        WHERE user_id = $1
        RETURNING *`,
        [
          userId, nickname, personal_url, bio, organization, country,
          mailing_address, contact_info_public, profile_visibility,
          github_url, linkedin_url, twitter_url, facebook_url, instagram_url, website_url
        ]
      )

      logger.info('Profile updated', { userId })
    }

    // Log activity
    await db(
      `INSERT INTO profiles.profile_activity (profile_id, action, changes, performed_by)
       VALUES ($1, $2, $3, $4)`,
      [result.rows[0].id, 'updated', JSON.stringify(body), userId]
    )

    return c.json({
      message: 'Perfil actualizado exitosamente',
      profile: result.rows[0]
    })
  } catch (error) {
    logger.error('Error updating profile', { userId, error: error.message })
    return c.json({ error: 'Error al actualizar perfil', details: error.message }, 500)
  }
})

/**
 * GET /profiles/search - Buscar perfiles públicos
 */
profiles.get('/search', async (c) => {
  const queryParams = c.req.query()
  const q = queryParams.q
  const country = queryParams.country
  const organization = queryParams.organization
  const limit = queryParams.limit || 20
  const offset = queryParams.offset || 0

  try {
    let query = `
      SELECT 
        up.id,
        up.nickname,
        up.bio,
        up.organization,
        up.country,
        u.username,
        u.first_name,
        u.last_name
      FROM profiles.user_profiles up
      INNER JOIN auth.users u ON up.user_id = u.id
      WHERE up.profile_visibility = 'public'
    `
    const params = []
    let paramCount = 0

    if (q) {
      paramCount++
      query += ` AND (
        u.username ILIKE $${paramCount} OR 
        up.nickname ILIKE $${paramCount} OR 
        up.bio ILIKE $${paramCount}
      )`
      params.push(`%${q}%`)
    }

    if (country) {
      paramCount++
      query += ` AND up.country = $${paramCount}`
      params.push(country)
    }

    if (organization) {
      paramCount++
      query += ` AND up.organization ILIKE $${paramCount}`
      params.push(`%${organization}%`)
    }

    query += ` ORDER BY up.updated_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`
    params.push(parseInt(limit), parseInt(offset))

    const result = await db(query, params)

    logger.info('Profile search executed', { q, country, organization, results: result.rows.length })

    return c.json({
      results: result.rows,
      count: result.rows.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    })
  } catch (error) {
    logger.error('Error searching profiles', { error: error.message })
    return c.json({ error: 'Error al buscar perfiles' }, 500)
  }
})

/**
 * GET /profiles/:username - Obtener perfil público por username
 */
profiles.get('/:username', optionalAuthMiddleware, async (c) => {
  const username = c.req.param('username')
  const viewerId = c.get('userId') // Puede ser undefined si no está autenticado

  try {
    const result = await db(
      `SELECT 
        up.*,
        u.username,
        u.first_name,
        u.last_name,
        CASE 
          WHEN up.contact_info_public THEN u.email
          ELSE NULL
        END as email,
        CASE 
          WHEN up.contact_info_public THEN u.phone
          ELSE NULL
        END as phone
      FROM profiles.user_profiles up
      INNER JOIN auth.users u ON up.user_id = u.id
      WHERE u.username = $1 AND (up.profile_visibility = 'public' OR up.user_id = $2)`,
      [username, viewerId]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Perfil no encontrado o privado' }, 404)
    }

    const profile = result.rows[0]

    // Register view if viewer is different from profile owner
    if (viewerId && viewerId !== profile.user_id) {
      await db(
        `INSERT INTO profiles.profile_views (profile_id, viewer_user_id, ip_address, user_agent)
         VALUES ($1, $2, $3, $4)`,
        [
          profile.id,
          viewerId,
          c.req.header('x-forwarded-for') || 'unknown',
          c.req.header('user-agent') || 'unknown'
        ]
      )
    }

    logger.info('Profile viewed', { username, viewerId })

    return c.json(profile)
  } catch (error) {
    logger.error('Error fetching profile by username', { username, error: error.message })
    return c.json({ error: 'Error al obtener perfil' }, 500)
  }
})

/**
 * GET /profiles/stats/me - Estadísticas del perfil (vistas, actividad)
 */
profiles.get('/stats/me', authMiddleware, async (c) => {
  const userId = c.get('userId')

  try {
    // Get profile ID
    const profileResult = await db(
      'SELECT id FROM profiles.user_profiles WHERE user_id = $1',
      [userId]
    )

    if (profileResult.rows.length === 0) {
      return c.json({ error: 'Perfil no encontrado' }, 404)
    }

    const profileId = profileResult.rows[0].id

    // Get view count
    const viewsResult = await db(
      'SELECT COUNT(*) as total_views FROM profiles.profile_views WHERE profile_id = $1',
      [profileId]
    )

    // Get recent activity
    const activityResult = await db(
      `SELECT action, changes, performed_at 
       FROM profiles.profile_activity 
       WHERE profile_id = $1 
       ORDER BY performed_at DESC 
       LIMIT 10`,
      [profileId]
    )

    return c.json({
      total_views: parseInt(viewsResult.rows[0].total_views),
      recent_activity: activityResult.rows
    })
  } catch (error) {
    logger.error('Error fetching profile stats', { userId, error: error.message })
    return c.json({ error: 'Error al obtener estadísticas' }, 500)
  }
})

export default profiles
