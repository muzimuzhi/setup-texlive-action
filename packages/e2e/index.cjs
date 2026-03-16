/**
 * Delete all caches created by this action.
 *
 * @param {object} args
 * @param {import('@actions/github', { with: { 'resolution-mode': 'import' } }).context} args.context
 * @param {import('@actions/core', { with: { 'resolution-mode': 'import' } })} args.core
 * @param {ReturnType<import('@actions/github', { with: { 'resolution-mode': 'import' } }).getOctokit>} args.github
 */
async function deleteCaches(args) {
  const { context, core, github: { paginate, rest } } = args;
  const { deleteActionsCacheByKey, getActionsCacheList } = rest.actions;
  const paginator = paginate.iterator(getActionsCacheList, {
    ...context.repo,
    per_page: 100,
    key: 'setup-texlive-action-',
  });
  for await (const { data } of paginator) {
    for (const { key } of data) {
      if (key !== undefined) {
        core.info(`Deleting ${key}`);
        try {
          await deleteActionsCacheByKey({ ...context.repo, key });
        } catch (error) {
          core.setFailed(`${error}`);
        }
      }
    }
  }
}

module.exports = { deleteCaches };
