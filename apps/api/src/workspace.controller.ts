import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Res } from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import { boardNameSchema, emailSchema, idSchema, memberRoleSchema, profileSchema } from '@board/shared';
import { z } from 'zod';
import { AuthService, ClientIp, cookieDigest, CurrentUser, Public, sessionCookie, type Identity } from './auth';
import { parse } from './board.controller';
import { BoardGateway } from './board.gateway';
import { WorkspaceService } from './workspace.service';

const emailInput = z.strictObject({ email: emailSchema });
const verifyInput = emailInput.extend({ code: z.string().regex(/^\d{6}$/u) });
const invitationInput = emailInput.extend({ role: memberRoleSchema });

@Controller()
export class WorkspaceController {
  constructor(private readonly auth: AuthService, private readonly workspace: WorkspaceService, private readonly gateway: BoardGateway) {}

  @Public()
  @HttpCode(204)
  @Post('auth/code')
  async requestCode(@Body() body: unknown, @ClientIp() ip: string) {
    await this.auth.requestCode(parse(emailInput, body).email, ip);
  }

  @Public()
  @HttpCode(200)
  @Post('auth/verify')
  async verify(@Body() body: unknown, @ClientIp() ip: string, @Headers('cookie') cookie: string | undefined,
    @Res({ passthrough: true }) response: ServerResponse) {
    const { email, code } = parse(verifyInput, body);
    const signedIn = await this.auth.verifyCode(email, code, ip, cookieDigest(cookie));
    response.setHeader('Set-Cookie', signedIn.cookie);
    return signedIn.account;
  }

  @HttpCode(204)
  @Post('auth/logout')
  async signOut(@CurrentUser() user: Identity, @Res({ passthrough: true }) response: ServerResponse) {
    await this.auth.signOut(user);
    response.setHeader('Set-Cookie', sessionCookie());
    this.gateway.disconnect(user.sessionDigest);
  }

  @Get('me')
  account(@CurrentUser() user: Identity) { return this.workspace.account(user.id); }

  @Patch('me')
  async profile(@CurrentUser() user: Identity, @Body() body: unknown) {
    const { name, avatar } = parse(profileSchema, body);
    const result = await this.workspace.profile(user.id, name, avatar);
    await Promise.all(result.boardIds.map((id) => this.gateway.refresh(id)));
    return result.account;
  }

  @Get('workspace')
  index(@CurrentUser() user: Identity) { return this.workspace.workspace(user); }

  @Post('boards')
  createBoard(@CurrentUser() user: Identity, @Body() body: unknown) {
    return this.workspace.createBoard(user.id, parse(z.strictObject({ name: boardNameSchema }), body).name);
  }

  @Get('card-links/:id')
  locateCard(@CurrentUser() user: Identity, @Param('id') cardId: string) {
    return this.workspace.locateCard(parse(idSchema, cardId), user.id);
  }

  @Get('boards/:id/members')
  members(@CurrentUser() user: Identity, @Param('id') id: string) {
    return this.workspace.members(parse(idSchema, id), user.id);
  }

  @HttpCode(204)
  @Post('boards/:id/invites')
  invite(@CurrentUser() user: Identity, @Param('id') id: string, @Body() body: unknown) {
    const { email, role } = parse(invitationInput, body);
    return this.workspace.invite(parse(idSchema, id), user, email, role);
  }

  @HttpCode(204)
  @Post('boards/:id/accept-invite')
  async accept(@CurrentUser() user: Identity, @Param('id') id: string) {
    const boardId = parse(idSchema, id);
    await this.workspace.accept(boardId, user);
    await this.gateway.refresh(boardId);
  }

  @HttpCode(204)
  @Post('boards/:id/revoke-invite')
  revoke(@CurrentUser() user: Identity, @Param('id') id: string, @Body() body: unknown) {
    return this.workspace.revokeInvite(parse(idSchema, id), user.id, parse(emailInput, body).email);
  }

  @HttpCode(204)
  @Patch('boards/:id/members/:accountId')
  async role(@CurrentUser() user: Identity, @Param('id') id: string, @Param('accountId') account: string, @Body() body: unknown) {
    const boardId = parse(idSchema, id);
    await this.workspace.changeMember(boardId, user.id, parse(idSchema, account), parse(z.strictObject({ role: memberRoleSchema }), body).role);
    await this.gateway.refresh(boardId);
  }

  @HttpCode(204)
  @Delete('boards/:id/members/:accountId')
  async remove(@CurrentUser() user: Identity, @Param('id') id: string, @Param('accountId') account: string) {
    const boardId = parse(idSchema, id);
    await this.workspace.changeMember(boardId, user.id, parse(idSchema, account));
    await this.gateway.refresh(boardId);
  }
}
