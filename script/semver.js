const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const readline = require("readline");

// Path to your changelog and package.json
const changelogPath = path.join(__dirname, "..", "CHANGELOG.md");
const packageJsonPath = path.join(__dirname, "..", "package.json");

function incrementVersion(version) {
  const parts = version.split(".");
  const patch = parseInt(parts[2], 10) + 1; // Increment the patch version
  parts[2] = patch.toString();
  return parts.join(".");
}

function prependToChangelog(version, changelog) {
  const currentDate = new Date().toISOString().split("T")[0]; // Get current date in YYYY-MM-DD format
  const changelogEntry = `## ${version} - ${currentDate}\n${changelog}\n\n`;

  // Read existing changelog
  const changelogContent = fs.existsSync(changelogPath)
    ? fs.readFileSync(changelogPath, "utf8")
    : "";

  // Prepend the new changelog entry
  const updatedChangelog = changelogEntry + changelogContent;

  // Write the updated changelog back to the file
  fs.writeFileSync(changelogPath, updatedChangelog, "utf8");
}

function updateVersionInPackageJson() {
  const packageJson = require(packageJsonPath);
  const newVersion = incrementVersion(packageJson.version);

  // Update the version in package.json
  packageJson.version = newVersion;

  // Write the updated package.json back to the file
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + "\n",
    "utf8"
  );

  return newVersion;
}

function commitChanges(changelog) {
  try {
    // Stage all changes
    execSync("git add .", { stdio: "inherit" });

    // Commit with the provided changelog
    execSync(`git commit -m "${changelog}"`, { stdio: "inherit" });

    console.log("\nChanges committed to Git");
    return true;
  } catch (error) {
    console.error("\nError committing changes:", error.message);
    process.exit(1);
  }
}

function pushCommit() {
  try {
    execSync(`git push`, { stdio: "inherit" });
    console.log("\nCommit pushed to Git");
    return true;
  } catch (error) {
    console.error("\nError pushing commit: ", error.message);
    process.exit(1);
  }
}

function buildZjax() {
  try {
    execSync(`npm run build`, { stdio: "inherit" });
    console.log("\nBuilt dist/zjax.min.js");
    return true;
  } catch (error) {
    console.error("\nError building dist/zjax.min.js: ", error.message);
    process.exit(1);
  }
}

function publishToNpm() {
  try {
    execSync(`npm publish`, { stdio: "inherit" });
    console.log("\nPublished to NPM");
    return true;
  } catch (error) {
    console.error("\nError publishing to NPM: ", error.message);
    process.exit(1);
  }
}

function updateChangelogAndVersion(changelog) {
  const newVersion = updateVersionInPackageJson();
  prependToChangelog(newVersion, changelog);

  console.log(`\nVersion updated to ${newVersion} and changelog entry added`);
}

async function prompt(question, defaultValue) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer || defaultValue);
    });
  });
}

async function confirm(question, defaultValue = "n") {
  const promptOptions = defaultValue === "y" ? "Y/n" : "y/N";
  const answer = await prompt(`${question} [${promptOptions}] `, defaultValue);
  return answer.toLowerCase() === "y";
}

async function promptForChangelog() {
  console.log(
    "Enter each changelog item on a new line.\nPress enter (submit a blank line) to complete."
  );
  const items = [];
  while (true) {
    const item = await prompt("\n- ");
    if (!item) {
      break;
    }
    items.push(item);
  }
  const changelog = items.map((item) => `- ${item}`).join("\n");
  return changelog;
}

async function main() {
  // Update the changelog and version in package.json
  const changelog = await promptForChangelog();
  updateChangelogAndVersion(changelog);

  // Build zjax.js?
  if (await confirm("Build dist/zjax.min.js?", "y")) {
    buildZjax();
  } else {
    console.log("\nNot building dist/zjax.min.js");
  }

  // Commit and push the changes to Git
  if (await confirm("\nCommit changes to Git?", "y")) {
    // Commit
    const committed = commitChanges(changelog);
    if (committed && (await confirm("\nPush this commit to Git?", "y"))) {
      // Push
      pushCommit();
    } else {
      console.log("\nChanges were not pushed");
    }
  } else {
    console.log("\nChanges were not committed");
  }

  // Publish to NPM
  if (await confirm("\nPublish to npm?", "y")) {
    publishToNpm();
  } else {
    console.log("\nNot publishing to npm");
  }

  console.log("\nFinished!");
}

main();
