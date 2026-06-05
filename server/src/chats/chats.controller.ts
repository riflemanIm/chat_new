import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtUser } from '../common/types/jwt-user.type';
import { AddMembersDto } from './dto/add-members.dto';
import { CreateDirectChatDto } from './dto/create-direct-chat.dto';
import { CreateGroupChatDto } from './dto/create-group-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { ChatsService } from './chats.service';

@ApiTags('Chats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Post('direct')
  createDirect(@CurrentUser() user: JwtUser, @Body() dto: CreateDirectChatDto) {
    return this.chatsService.createDirect(user.sub, dto);
  }

  @Post('group')
  createGroup(@CurrentUser() user: JwtUser, @Body() dto: CreateGroupChatDto) {
    return this.chatsService.createGroup(user.sub, dto);
  }

  @Get()
  findMyChats(@CurrentUser() user: JwtUser) {
    return this.chatsService.findMyChats(user.sub);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.chatsService.findOne(user.sub, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateChatDto) {
    return this.chatsService.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.chatsService.remove(user.sub, id);
  }

  @Post(':id/members')
  addMembers(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: AddMembersDto) {
    return this.chatsService.addMembers(user.sub, id, dto);
  }

  @Delete(':id/members/:userId')
  removeMember(@CurrentUser() user: JwtUser, @Param('id') id: string, @Param('userId') userId: string) {
    return this.chatsService.removeMember(user.sub, id, userId);
  }
}
