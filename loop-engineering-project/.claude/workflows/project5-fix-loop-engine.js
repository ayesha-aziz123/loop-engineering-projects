export const meta = {
  name: 'project5-fix-loop-engine',
  description: 'Codified Project 4 fix-loop body: fix several candidate bugs in parallel isolated worktrees, each independently reviewed, each given a clear verdict.',
  phases: [
    { title: 'Fix', detail: 'isolate each candidate into its own worktree, reproduce, fix root cause, re-check' },
    { title: 'Review', detail: 'independent fix-reviewer verdict per candidate' },
    { title: 'Decide', detail: 'stage PR description on PASS, nothing on FAIL' },
  ],
}

const REPO_DIR = 'C:/Users/HP/Desktop/agent-factory-practice-project/loop-engineering-project'
const WORKTREE_PARENT = 'C:/Users/HP/Desktop/agent-factory-practice-project'
const APP_DIR = '05-codify-the-body/target-app'

const CANDIDATES = [
  {
    id: 'clamp',
    description: 'clampToRange(value, min, max) in src/clamp.js is wrong: in-range values fall through and return max instead of value, and values above max are returned unclamped instead of being pulled down to max.',
    srcFile: 'src/clamp.js',
    testFile: 'test/clamp.test.js',
  },
  {
    id: 'average',
    description: 'average(nums) in src/average.js divides the sum by (nums.length - 1) instead of nums.length, so every result is wrong and a single-element array divides by zero.',
    srcFile: 'src/average.js',
    testFile: 'test/average.test.js',
  },
  {
    id: 'dedupe',
    description: 'dedupeSorted(arr) in src/dedupeSorted.js starts its loop at index 1, so the first element of the array is always dropped (a single-element array returns an empty array).',
    srcFile: 'src/dedupeSorted.js',
    testFile: 'test/dedupeSorted.test.js',
  },
]

const MAKER_SCHEMA = {
  type: 'object',
  properties: {
    candidateId: { type: 'string' },
    checkerPassed: { type: 'boolean' },
    worktreePath: { type: 'string' },
    branch: { type: 'string' },
    commitSha: { type: 'string' },
    diffSummary: { type: 'string' },
  },
  required: ['candidateId', 'checkerPassed', 'worktreePath', 'branch', 'commitSha', 'diffSummary'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['PASS', 'FAIL'] },
    reasons: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'reasons'],
}

const runId = (args && args.runId) ? String(args.runId) : 'no-run-id'
log(`Project 5 fix-loop engine run ${runId} starting on ${CANDIDATES.length} candidates`)

phase('Fix')
const results = await pipeline(
  CANDIDATES,
  (candidate) => {
    const worktreePath = `${WORKTREE_PARENT}/p5-${candidate.id}-${runId}`
    const branch = `p5/${candidate.id}/${runId}`
    return agent(
      `You are the "maker" step of a codified fix-loop engine (Project 5), fixing one candidate bug reused as-is from a shared target app.\n\n` +
      `Repo (do NOT edit this working tree directly): ${REPO_DIR}\n` +
      `App directory inside the repo/worktree: ${APP_DIR}\n\n` +
      `Candidate id: ${candidate.id}\n` +
      `Bug: ${candidate.description}\n` +
      `Source file (relative to ${APP_DIR}): ${candidate.srcFile}\n` +
      `Test file (relative to ${APP_DIR}): ${candidate.testFile}\n\n` +
      `Steps, using the Bash tool:\n` +
      `1. Isolate: from ${REPO_DIR}, run exactly:\n   git worktree add "${worktreePath}" -b "${branch}"\n` +
      `   Never edit ${REPO_DIR} directly.\n` +
      `2. Reproduce: cd into "${worktreePath}/${APP_DIR}" and run:\n   node --test ${candidate.testFile}\n` +
      `   Confirm it fails for the expected reason before touching any code.\n` +
      `3. Fix: edit ${candidate.srcFile} in that worktree to fix the ROOT CAUSE of the bug. Make the smallest change that generalizes -- do not special-case the literal values in ${candidate.testFile}.\n` +
      `4. Re-check: re-run node --test ${candidate.testFile} in that worktree until it exits 0.\n` +
      `5. Commit your fix in that worktree (git add / git commit) with a descriptive message, scoped only to ${candidate.srcFile}.\n\n` +
      `Report back: candidateId ("${candidate.id}"), whether the checker passed (checkerPassed), the worktree path ("${worktreePath}"), the branch name ("${branch}"), the commit sha of your fix commit (run git rev-parse HEAD in the worktree), and a short diffSummary of what you changed.`,
      { schema: MAKER_SCHEMA, phase: 'Fix', label: `fix:${candidate.id}` },
    )
  },
  (makerResult, candidate) => agent(
    `Review a proposed bug fix for Project 5 candidate "${candidate.id}".\n\n` +
    `Bug description: ${candidate.description}\n\n` +
    `The fix has been committed as commit ${makerResult ? makerResult.commitSha : 'UNKNOWN'} on branch ${makerResult ? makerResult.branch : 'UNKNOWN'}, ` +
    `in the worktree at ${makerResult ? makerResult.worktreePath : 'UNKNOWN'} (app directory "${APP_DIR}" inside it). ` +
    `The maker's own claim about the checker: ${makerResult && makerResult.checkerPassed ? 'reported passing' : 'reported NOT passing or unknown -- verify independently'}.\n\n` +
    `Run: git -C "${makerResult ? makerResult.worktreePath : ''}" log -p -1 -- ${APP_DIR}/${candidate.srcFile}\n` +
    `to see the diff. Then run the checker yourself: cd "${makerResult ? makerResult.worktreePath : ''}/${APP_DIR}" && node --test ${candidate.testFile} -- do NOT trust the maker's claim, confirm it yourself.\n\n` +
    `Evaluate per your standard criteria (checker result, overfitting vs. general fix, scope, root cause, regressions) and report your verdict ("PASS" or "FAIL") with concrete reasons.`,
    { agentType: 'fix-reviewer', schema: REVIEW_SCHEMA, phase: 'Review', label: `review:${candidate.id}` },
  ).then((review) => ({ candidate, maker: makerResult, review })),
)

phase('Decide')
const decided = await pipeline(
  results,
  async (r) => {
    if (!r || !r.review || !r.maker) {
      return { ...r, prStaged: false, note: 'incomplete pipeline result' }
    }
    if (r.review.verdict !== 'PASS') {
      return { ...r, prStaged: false }
    }
    await agent(
      `The fix for Project 5 candidate "${r.candidate.id}" passed independent review. ` +
      `In the worktree at ${r.maker.worktreePath} (app directory "${APP_DIR}"), write a PR_DESCRIPTION.md ` +
      `(title, summary of the bug and fix, test plan referencing "node --test ${r.candidate.testFile}") ` +
      `and commit it there with git. Do not merge or push anywhere. Report back only "done" when committed.`,
      { phase: 'Decide', label: `stage-pr:${r.candidate.id}` },
    )
    return { ...r, prStaged: true }
  },
)

phase('Summarize')
for (const r of decided) {
  if (!r) { log('candidate: pipeline error, no result'); continue }
  log(`candidate=${r.candidate.id} verdict=${r.review ? r.review.verdict : 'UNKNOWN'} prStaged=${r.prStaged} branch=${r.maker ? r.maker.branch : 'n/a'}`)
}

return { runId, results: decided }
