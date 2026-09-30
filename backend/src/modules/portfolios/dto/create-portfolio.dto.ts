import { IsString, MaxLength, MinLength } from 'class-validator';
import { PortfolioImportDto } from './preview-portfolio.dto.js';

export class CreatePortfolioDto extends PortfolioImportDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;
}
