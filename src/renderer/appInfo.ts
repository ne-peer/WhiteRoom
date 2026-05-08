import packageInfo from '../../package.json'

const repositoryUrl = packageInfo.repository.url.replace(/\.git$/u, '')
const repositoryLabel = repositoryUrl.replace(/^https?:\/\//u, '')

export const APP_INFO = {
  name: 'WhiteRoom',
  version: packageInfo.version,
  developer: packageInfo.author,
  copyright: `2026 ${packageInfo.author}`,
  repositoryUrl,
  repositoryLabel,
} as const
