import {
  CurrentUserSchema,
  LoginRequestSchema,
  SessionResponseSchema,
  type LoginRequest,
} from '@dove/contracts'
import type { FastifyPluginAsync } from 'fastify'

import type { AppConfig } from '../../config.js'
import { AppError } from '../../platform/app-error.js'
import { randomToken } from '../../platform/crypto.js'
import { SlidingWindowRateLimiter } from '../../platform/request-security.js'
import { CSRF_COOKIE, SESSION_COOKIE, type AuthGuards } from './auth-guards.js'
import type { IdentityService } from './identity-service.js'

interface IdentityRouteOptions {
  config: AppConfig['auth']
  guards: AuthGuards
  loginRequestsPerMinute: number
  service: IdentityService
}

const baseCookie = (secure: boolean) => ({
  httpOnly: true,
  path: '/',
  sameSite: 'lax' as const,
  secure,
})

export const identityRoutes: FastifyPluginAsync<IdentityRouteOptions> = async (app, options) => {
  const loginLimiter = new SlidingWindowRateLimiter(options.loginRequestsPerMinute)
  app.post<{ Body: LoginRequest }>(
    '/login',
    {
      schema: {
        body: LoginRequestSchema,
        response: { 200: SessionResponseSchema },
        tags: ['identity'],
      },
    },
    async (request, reply) => {
      if (!loginLimiter.consume(request.ip))
        throw new AppError(429, 'LOGIN_RATE_LIMITED', 'Bạn đã đăng nhập sai quá nhiều lần.')
      const session = await options.service.login(request.body.email, request.body.password)
      const csrfToken = randomToken()
      reply.setCookie(SESSION_COOKIE, session.token, {
        ...baseCookie(options.config.cookieSecure),
        expires: new Date(session.expiresAt),
      })
      reply.setCookie(CSRF_COOKIE, csrfToken, {
        ...baseCookie(options.config.cookieSecure),
        httpOnly: false,
        expires: new Date(session.expiresAt),
      })
      return { user: session.user, expiresAt: session.expiresAt }
    },
  )

  app.get(
    '/session',
    {
      preHandler: options.guards.requireUser,
      schema: { response: { 200: SessionResponseSchema }, tags: ['identity'] },
    },
    async (request) => {
      const session = await options.service.authenticate(request.cookies[SESSION_COOKIE])
      return session
    },
  )

  app.post(
    '/logout',
    {
      preHandler: options.guards.requireMutation,
      schema: { response: { 200: CurrentUserSchema }, tags: ['identity'] },
    },
    async (request, reply) => {
      await options.service.logout(request.cookies[SESSION_COOKIE])
      reply.clearCookie(SESSION_COOKIE, { path: '/' })
      reply.clearCookie(CSRF_COOKIE, { path: '/' })
      return request.currentUser
    },
  )
}
