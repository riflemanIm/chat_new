import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtUser } from '../common/types/jwt-user.type';
import { CreateMessageDto } from './dto/create-message.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { MessagesService } from './messages.service';

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('chats/:chatId/messages')
  create(@CurrentUser() user: JwtUser, @Param('chatId') chatId: string, @Body() dto: CreateMessageDto) {
    return this.messagesService.create(user.sub, chatId, dto);
  }

  @Get('chats/:chatId/messages')
  list(@CurrentUser() user: JwtUser, @Param('chatId') chatId: string, @Query() dto: ListMessagesDto) {
    return this.messagesService.list(user.sub, chatId, dto);
  }

  @Patch('messages/:id')
  update(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateMessageDto) {
    return this.messagesService.update(user.sub, id, dto);
  }

  @Delete('messages/:id')
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.messagesService.remove(user.sub, id);
  }

  @Post('messages/:id/read')
  markRead(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.messagesService.markRead(user.sub, id);
  }
}
