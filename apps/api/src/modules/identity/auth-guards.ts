import { timingSafeEqual } from 'node:crypto'

import type { FastifyRequest } from 'fastify'

import { AppError } from '../../platform/app-error.js'
import type { IdentityService } from './identity-service.js'

export const SESSION_COOKIE = 'dove_session'
export const CSRF_COOKIE = 'dove_csrf'

function equalTokens(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function createAuthGuards(identity: IdentityService) {
  const requireUser = async (request: FastifyRequest): Promise<void> => {
    const session = await identity.authenticate(request.cookies[SESSION_COOKIE])
    request.currentUser = session.user
  }

  const requireMutation = async (request: FastifyRequest): Promise<void> => {
    await requireUser(request)
    const header = request.headers['x-csrf-token']
    const cookie = request.cookies[CSRF_COOKIE]
    if (typeof header !== 'string' || !cookie || !equalTokens(header, cookie)) {
      throw new AppError(403, 'CSRF_INVALID', 'Mã bảo vệ yêu cầu không hợp lệ.')
    }
  }

  const requireCatalogAdmin = async (request: FastifyRequest): Promise<void> => {
    await requireMutation(request)
    if (!request.currentUser || !['owner', 'catalog_admin'].includes(request.currentUser.role)) {
      throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền quản lý danh mục.')
    }
  }

  return { requireUser, requireMutation, requireCatalogAdmin }
}

export type AuthGuards = ReturnType<typeof createAuthGuards>
