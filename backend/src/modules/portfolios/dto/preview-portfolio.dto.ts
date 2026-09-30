import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { MAX_ROWS, RecipeType } from '../recipes/expand-recipe.js';

// Only the envelope is validated here; each row and the recipe options are
// validated by expandRecipe (Zod) so a bad row comes back as a per-row
// error instead of failing the whole request on its first problem — same
// split CreateAlarmDto uses for `params`.
export class PortfolioImportDto {
  @IsEnum(RecipeType)
  recipe!: RecipeType;

  @IsArray()
  @ArrayMaxSize(MAX_ROWS)
  rows!: unknown[];

  // Import-wide options (the ladder's dropPct/gainPct/entries). Omitted for
  // recipes that take none.
  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;
}

// The UI sends the exact same payload to preview and create, so preview
// must accept `name` (the global ValidationPipe forbids unknown properties)
// even though it has no use for it. Deliberately not the base of
// CreatePortfolioDto: class-validator would inherit this @IsOptional and
// make `name` optional there too.
export class PreviewPortfolioDto extends PortfolioImportDto {
  @IsOptional()
  @IsString()
  name?: string;
}
