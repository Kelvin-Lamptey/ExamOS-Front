import { test, expect, type Page } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createMockService } from '../../mock/service'

let service: Awaited<ReturnType<typeof createMockService>>
let dataDir: string

test.beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'examos-e2e-'))
  service = await createMockService({
    dataDir,
    offline: true,
    syncDelayMs: 100,
  })
  await new Promise<void>((resolve, reject) => {
    service.server.once('error', reject)
    service.server.listen(43100, '127.0.0.1', resolve)
  })
})
test.afterEach(async ({ page }) => {
  await page.close()
  await service.close()
  await rm(dataDir, { recursive: true, force: true })
})

async function login(page: Page) {
  await page.goto('/#/login')
  await page.getByLabel('Student ID', { exact: true }).fill('GCTU-CS-001')
  await page.getByLabel('Access code', { exact: true }).fill('A7K2')
  await page.getByRole('button', { name: 'Enter workspace' }).click()
  await expect(
    page.getByRole('heading', { name: 'Welcome back, Kelvin.' }),
  ).toBeVisible()
}
async function start(page: Page) {
  await page.getByRole('link', { name: 'View exam', exact: true }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Start exam', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: /Which object-oriented concept/ }),
  ).toBeVisible()
}
const answer = (page: Page) => page.getByLabel('Your answer', { exact: true })

test('complete all five question types offline, restore, submit once, and sync', async ({
  page,
}) => {
  const external: string[] = []
  const errors: string[] = []
  const revisions: number[] = []
  let submits = 0
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (
      /^https?:/.test(request.url()) &&
      !request.url().startsWith('http://127.0.0.1:')
    )
      external.push(request.url())
    if (request.method() === 'PUT')
      revisions.push(request.postDataJSON().revision)
    if (request.method() === 'POST' && request.url().endsWith('/submit'))
      submits++
  })
  await login(page)
  await page.screenshot({ path: 'test-results/launcher.png', fullPage: true })
  await page.getByRole('button', { name: /calculator/i }).click()
  await page.getByLabel('Calculator expression').fill('2+3*4')
  await page.getByRole('button', { name: 'Equals', exact: true }).click()
  await expect(page.getByLabel('Calculator result')).toHaveText('14')
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.getByRole('button', { name: /scratchpad/i }).click()
  await page
    .getByLabel('Rough work')
    .fill('Home notes, isolated from exam notes.')
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await start(page)
  await page.getByRole('button', { name: /scratchpad/i }).click()
  await expect(page.getByLabel('Rough work')).toHaveValue('')
  await page.getByLabel('Rough work').fill('Exam rough work')
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.getByText('Encapsulation', { exact: true }).click()
  await expect(
    page.getByText('Saved locally – waiting to sync', { exact: true }),
  ).toBeVisible()
  await page.screenshot({
    path: 'test-results/exam-runner.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Next question' }).click()
  await answer(page).fill('Use case diagram')
  await page.getByRole('button', { name: 'Next question' }).click()
  await answer(page).fill(
    'Cohesion groups related responsibilities.\nCoupling describes dependencies between classes.',
  )
  await page.getByRole('button', { name: 'Next question' }).click()
  await page.getByLabel('Your numeric answer').fill('42.5')
  await page.getByRole('button', { name: 'Next question' }).click()
  await page
    .getByLabel('Your code', { exact: true })
    .fill('public class Student {\n  private String name;\n}')
  await expect(
    page.getByText('Saved locally – waiting to sync', { exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('radio', { name: 'Encapsulation', exact: true }),
  ).toBeChecked()
  await page
    .getByRole('button', { name: 'Question 2, answered', exact: true })
    .click()
  await expect(answer(page)).toHaveValue('Use case diagram')
  await page
    .getByRole('button', { name: 'Question 3, answered', exact: true })
    .click()
  await expect(answer(page)).toHaveValue(
    'Cohesion groups related responsibilities.\nCoupling describes dependencies between classes.',
  )
  await page
    .getByRole('button', { name: 'Question 4, answered', exact: true })
    .click()
  await expect(page.getByLabel('Your numeric answer')).toHaveValue('42.5')
  await page
    .getByRole('button', { name: 'Question 5, answered', exact: true })
    .click()
  await expect(page.getByLabel('Your code', { exact: true })).toHaveValue(
    'public class Student {\n  private String name;\n}',
  )
  await page.getByRole('button', { name: 'Review & submit' }).click()
  await expect(page.getByRole('dialog')).toContainText(
    '5 of 5 questions answered',
  )
  await page.getByRole('button', { name: 'Submit final answers' }).dblclick()
  await expect(
    page.getByRole('heading', { name: 'Your exam is submitted.' }),
  ).toBeVisible()
  expect(submits).toBe(1)
  await expect(page.getByText('Mock sync: waiting to sync')).toBeVisible()
  const reference = await page.getByTestId('submission-id').textContent()
  await page.screenshot({ path: 'test-results/submission.png', fullPage: true })
  await page.reload()
  await expect(page.getByTestId('submission-id')).toHaveText(reference!)
  await page.goto('/#/exams/exam_ooad_001/run')
  await expect(
    page.getByRole('heading', { name: 'Your exam is submitted.' }),
  ).toBeVisible()
  expect(await page.getByRole('textbox').count()).toBe(0)
  service.setOffline(false)
  await expect(page.getByText('Mock sync: complete')).toBeVisible()
  await page.getByRole('link', { name: 'Back to my exams' }).click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Welcome to your workspace.' }),
  ).toBeVisible()
  expect(external).toEqual([])
  expect(errors).toEqual([])
  expect(
    revisions.every((revision, i) => i === 0 || revision > revisions[i - 1]!),
  ).toBe(true)
})

test('recoverable boot, exact access code, and small-screen layout', async ({
  page,
}) => {
  await page.route('**/v1/health', (route) => route.abort())
  await page.goto('/#/login')
  await expect(
    page.getByRole('heading', { name: 'Let’s get you connected.' }),
  ).toBeVisible()
  await page.unroute('**/v1/health')
  await page.getByRole('button', { name: 'Retry connection' }).click()
  await expect(page.getByLabel('Access code', { exact: true })).toBeVisible()
  await page.getByLabel('Student ID', { exact: true }).fill('GCTU-CS-001')
  await page.getByLabel('Access code', { exact: true }).fill('A!K2')
  await page.getByRole('button', { name: 'Enter workspace' }).click()
  await expect(
    page.getByRole('heading', { name: 'Welcome to your workspace.' }),
  ).toBeVisible()
  await page.getByLabel('Access code', { exact: true }).fill('A7K2')
  await page.getByRole('button', { name: 'Enter workspace' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(
    page.getByRole('heading', { name: 'Welcome back, Kelvin.' }),
  ).toBeVisible()
  await page.screenshot({
    path: 'test-results/mobile-launcher.png',
    fullPage: true,
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await start(page)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test('failed local save prevents navigation and preserves the draft for retry', async ({
  page,
}) => {
  await login(page)
  await start(page)
  await page.getByRole('button', { name: 'Next question' }).click()
  await page.route('**/v1/exams/*/answers/*', (route) => route.abort())
  await answer(page).fill('Do not lose this draft')
  await page.getByRole('button', { name: 'Next question' }).click()
  await expect(page.getByText('Your latest changes need saving')).toBeVisible()
  await expect(answer(page)).toHaveValue('Do not lose this draft')
  await expect(
    page.getByText('Not saved locally', { exact: true }),
  ).toBeVisible()
  await page.unroute('**/v1/exams/*/answers/*')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(
    page.getByText('Saved locally – waiting to sync', { exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'My exams', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Welcome back, Kelvin.' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Continue exam' }).click()
  await page.getByRole('button', { name: 'Continue exam' }).click()
  await page
    .getByRole('button', { name: 'Question 2, answered', exact: true })
    .click()
  await expect(answer(page)).toHaveValue('Do not lose this draft')
})

test('a lost submit response is reconciled from the backend without a second POST', async ({
  page,
}) => {
  await login(page)
  await start(page)
  let submissions = 0
  await page.route('**/v1/exams/*/submit', async (route) => {
    submissions++
    await route.fetch()
    await route.abort()
  })
  await page.getByRole('button', { name: 'Submit exam', exact: true }).click()
  await page.getByRole('button', { name: 'Submit final answers' }).click()
  await expect(
    page.getByRole('heading', { name: 'Your exam is submitted.' }),
  ).toBeVisible()
  expect(submissions).toBe(1)
})

test('expired sessions restore the same student without losing unsaved typing', async ({
  page,
}) => {
  await login(page)
  await start(page)
  await page.getByRole('button', { name: 'Next question' }).click()
  await page.route(
    '**/v1/exams/*/answers/*',
    (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Sign in again.',
            retryable: false,
          },
        }),
      }),
    { times: 1 },
  )
  await answer(page).fill('Keep my draft during reauthentication')
  await expect(
    page.getByRole('dialog', { name: 'Restore your student session' }),
  ).toBeVisible()
  await expect(page.getByLabel('Student ID', { exact: true })).toHaveValue(
    'GCTU-CS-001',
  )
  await page.getByLabel('Access code', { exact: true }).fill('A7K2')
  await page.getByRole('button', { name: 'Enter workspace' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(answer(page)).toHaveValue(
    'Keep my draft during reauthentication',
  )
  await expect(
    page.getByText('Saved locally – waiting to sync', { exact: true }),
  ).toBeVisible()
})

test('exam navigation flushes a draft before leaving the runner', async ({
  page,
}) => {
  await login(page)
  await start(page)
  await page.getByRole('button', { name: 'Next question' }).click()
  await answer(page).fill('Save immediately when I leave')
  await page.getByRole('link', { name: 'My exams', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Welcome back, Kelvin.' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Continue exam' }).click()
  await page.getByRole('button', { name: 'Continue exam' }).click()
  await page
    .getByRole('button', { name: 'Question 2, answered', exact: true })
    .click()
  await expect(answer(page)).toHaveValue('Save immediately when I leave')
})

test('deadline expiry submits automatically once and leaves the exam locked', async ({
  page,
}) => {
  await login(page)
  let deadline = ''
  let submits = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/submit'))
      submits++
  })
  await page.route(/\/v1\/exams\/exam_ooad_001(?:\/start)?$/, async (route) => {
    const response = await route.fetch()
    const data = await response.json()
    if (data.attempt) {
      deadline ||= new Date(Date.now() + 1500).toISOString()
      data.attempt.expires_at = deadline
    }
    await route.fulfill({ response, json: data })
  })
  await start(page)
  await expect(
    page.getByRole('heading', { name: 'Your exam is submitted.' }),
  ).toBeVisible()
  expect(submits).toBe(1)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Your exam is submitted.' }),
  ).toBeVisible()
})
