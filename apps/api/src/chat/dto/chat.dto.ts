import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsArray,
  IsBoolean,
  ArrayNotEmpty,
  ArrayMinSize,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';

export class CreateConversationDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  type?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  participantIds: string[];
}

export class SendMessageDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message: string;

  @IsString()
  @IsOptional()
  @MaxLength(2048)
  attachmentUrl?: string;
}

export class TypingDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId: string;

  @IsBoolean()
  @IsNotEmpty()
  isTyping: boolean;
}

export class MarkReadDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId: string;
}

