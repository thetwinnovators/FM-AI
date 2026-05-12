import { z, ZodSchema } from 'zod'

const NonEmptyString = z.string().min(1)

export const schemas: Record<string, ZodSchema> = {
  'file.read': z.object({ path: NonEmptyString }).strict(),
  'file.list': z.object({
    path: NonEmptyString,
    recursive: z.boolean().optional(),
    glob: z.string().optional(),
  }).strict(),
  'file.exists': z.object({ path: NonEmptyString }).strict(),
  'file.write': z.object({
    path: NonEmptyString,
    content: z.string(),
    mode: z.enum(['overwrite', 'append']).optional(),
  }).strict(),
  'file.delete': z.object({
    path: NonEmptyString,
    recursive: z.boolean().optional(),
  }).strict(),

  'system.exec': z.object({
    command: NonEmptyString,
    args: z.array(z.string()),
    cwd: z.string().optional(),
    timeoutMs: z.number().int().positive().max(600_000).optional(),
    env: z.record(z.string()).optional(),
  }).strict(),
  'system.exec_inline': z.object({
    script: NonEmptyString,
    shell: z.enum(['bash', 'pwsh']).optional(),
    cwd: z.string().optional(),
    timeoutMs: z.number().int().positive().max(600_000).optional(),
  }).strict(),

  'browser.open': z.object({
    headless: z.boolean().optional(),
    viewport: z.object({ width: z.number().int(), height: z.number().int() }).optional(),
  }).strict(),
  'browser.navigate': z.object({
    sessionId: NonEmptyString,
    url: NonEmptyString,
    waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
  }).strict(),
  'browser.screenshot': z.object({
    sessionId: NonEmptyString,
    fullPage: z.boolean().optional(),
    selector: z.string().optional(),
  }).strict(),
  'browser.extract': z.object({
    sessionId: NonEmptyString,
    selector: NonEmptyString,
    attr: z.enum(['text', 'html', 'href', 'value']).optional(),
  }).strict(),
  'browser.evaluate': z.object({
    sessionId: NonEmptyString,
    script: NonEmptyString,
  }).strict(),
  'browser.click': z.object({
    sessionId: NonEmptyString,
    selector: NonEmptyString,
    timeoutMs: z.number().int().positive().optional(),
  }).strict(),
  'browser.fill': z.object({
    sessionId: NonEmptyString,
    selector: NonEmptyString,
    value: z.string(),
  }).strict(),
  'browser.close': z.object({ sessionId: NonEmptyString }).strict(),

  'git.status': z.object({
    repoPath: NonEmptyString,
  }).strict(),

  'git.log': z.object({
    repoPath: NonEmptyString,
    maxCount: z.number().int().positive().max(100).optional(),
  }).strict(),

  'git.diff': z.object({
    repoPath: NonEmptyString,
    staged: z.boolean().optional(),
  }).strict(),

  'git.add': z.object({
    repoPath: NonEmptyString,
    files: z.array(NonEmptyString).min(1),
  }).strict(),

  'git.commit': z.object({
    repoPath: NonEmptyString,
    message: NonEmptyString,
  }).strict(),
}
