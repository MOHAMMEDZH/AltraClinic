import { BadRequestException, NotFoundException } from '@nestjs/common';

export class MediaNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Media asset not found: ${id}`);
  }
}

export class MediaQuarantinedException extends BadRequestException {
  constructor(id: string, reason: string) {
    super(`Media asset ${id} is quarantined: ${reason}`);
  }
}

export class UnsupportedMediaTypeException extends BadRequestException {
  constructor(mimeType: string) {
    super(`Unsupported media type: ${mimeType}`);
  }
}

export class MediaFileTooLargeException extends BadRequestException {
  constructor(maxBytes: number) {
    super(`File exceeds maximum allowed size of ${maxBytes} bytes`);
  }
}
