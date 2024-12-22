const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Path to your changelog and package.json
const changelogPath = path.join(__dirname, "CHANGELOG.md");
const packageJsonPath = path.join(__dirname, "package.json");

// Function to increment the version
function incrementVersion(version) {
  const parts = version.split(".");
  const patch = parseInt(parts[2], 10) + 1; // Increment the patch version
  parts[2] = patch.toString();
  return parts.join(".");
}

// Function to prepend to changelog
function prependToChangelog(version, message) {
  const currentDate = new Date().toISOString().split("T")[0]; // Get current date in YYYY-MM-DD format
  const changelogEntry = `## ${version} - ${currentDate}\n\n- ${message}\n\n`;

  // Read existing changelog
  const changelogContent = fs.existsSync(changelogPath)
    ? fs.readFileSync(changelogPath, "utf8")
    : "";

  // Prepend the new changelog entry
  const updatedChangelog = changelogEntry + changelogContent;

  // Write the updated changelog back to the file
  fs.writeFileSync(changelogPath, updatedChangelog, "utf8");
}

// Function to update the version in package.json
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

// Function to commit changes using Git
function commitChanges(message) {
  try {
    // Stage all changes
    execSync("git add .", { stdio: "inherit" });

    // Commit with the provided message
    execSync(`git commit -m "${message}"`, { stdio: "inherit" });

    console.log("Changes committed successfully.");
  } catch (error) {
    console.error("Error committing changes:", error.message);
    process.exit(1);
  }
}

// Main function to update changelog, version, and commit changes
function updateChangelogAndVersion(message) {
  const newVersion = updateVersionInPackageJson();
  prependToChangelog(newVersion, message);

  console.log(`Version updated to ${newVersion} and changelog entry added.`);

  // Commit the changes
  commitChanges(message);
}

const args = process.argv.slice(2);

if (args.length > 1) {
  console.error(
    "*** SemVer Error: Too many arguments (just one description as a string please) ***"
  );
  process.exit(1); // Exit with error code if the number of arguments is incorrect
}

const message = args[0];

if (!message) {
  console.error("\n*** SemVer Error: Missing changelog description ***\n");
  process.exit(1); // Exit with error code
}

updateChangelogAndVersion(message);
