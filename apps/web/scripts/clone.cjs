const { loadEnvConfig } = require("@next/env");
const git = require("isomorphic-git")
const http = require("isomorphic-git/http/node")
const fs = require("node:fs")
const path = require("node:path")
const os = require('node:os')

loadEnvConfig(process.cwd());

const token = process.env.GH_TOKEN;
const url = process.env.DATA_REPOSITORY;
// Optional branch of the content repo (e.g. a `data` branch inside the website repo).
// DATA_REPOSITORY_BRANCH, else GITHUB_BRANCH (older deployments); unset = the remote default branch.
const branch = (process.env.DATA_REPOSITORY_BRANCH && process.env.DATA_REPOSITORY_BRANCH.trim()) ||
  (process.env.GITHUB_BRANCH && process.env.GITHUB_BRANCH.trim()) || undefined;
const refOptions = branch ? { ref: branch } : {};

if (!url) {
  console.warn("Warning: 'DATA_REPOSITORY' environment variable is missing.");
  console.warn("Content repository will not be cloned. Some content may not be available.");
  process.exit(0); // Exit gracefully without error
}


function getContentPath() {
  const contentDir = '.content';
  // Always use project directory during build to ensure content is included in deployment
  return path.join(process.cwd(), contentDir);
}

const auth = { username: "x-access-token", password: token };
const dest = getContentPath();

async function main() {
  await fs.promises.mkdir(dest, { recursive: true });

  // If already cloned, pull the latest content instead of skipping.
  const gitDir = path.join(dest, '.git');
  if (fs.existsSync(gitDir)) {
    console.log("Content repo already present, pulling latest changes:", dest);

    const pullOptions = {
      fs,
      http,
      url,
      dir: dest,
      author: { name: "website" },
      singleBranch: true,
      ...refOptions,
    };

    if (token) {
      pullOptions.onAuth = () => auth;
    }

    await git.pull(pullOptions);
    return;
  }

  console.log("Cloning content repository to", dest, branch ? `(branch ${branch})` : "(default branch)");

  const cloneOptions = {
    fs,
    http,
    url,
    dir: dest,
    singleBranch: true,
      ...refOptions,
  }

  if (token) {
    cloneOptions.onAuth = () => auth;
  }

  await git.clone(cloneOptions);
}

main().catch(err => {
  console.warn("Continuing build without content repository.", err);
  process.exit(0);
});
