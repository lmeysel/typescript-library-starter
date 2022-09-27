/**
 * This script runs automatically after your first npm-install.
 */
import { prompt } from 'enquirer';
import { mv, rm, which, exec } from 'shelljs';
import * as replace from 'replace-in-file';
import * as kleur from 'kleur';
import * as path from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { fork } from 'child_process';

// Note: These should all be relative to the project root directory
const rmDirs = ['.git', 'tools/resources', 'tools'];
const rmFiles = ['.all-contributorsrc', '.gitattributes', '.github/workflows/typescript-library-starter.yml'];
const modifyFiles = ['LICENSE', 'package.json', 'vite.config.ts', 'test/dummy.test.ts', 'tools/gh-pages-publish.ts'];
const renameFiles = [
  ['src/library.ts', 'src/--libraryname--.ts'],
  ['tools/resources/nodejs.yml', '.github/workflows/nodejs.yml'],
];

const _suggestLibraryName = function () {
  const seg = __dirname.split(path.sep);
  const ret = seg[seg.length - 2];
  return ret.toLowerCase().replace(/[^a-z0-9]+/gi, '-');
};

// Clear console
process.stdout.write('\x1B[2J\x1B[0f');

if (!which('git')) {
  console.log(kleur.red('Sorry, this script requires git'));
  process.exit(1);
}

// Say hi!
console.log(kleur.cyan("Hi! You're almost ready to make the next great TypeScript library."));

// Generate the library name and start the tasks
if (process.env.CI == null) {
  libraryNameCreate();
} else {
  // This is being run in a CI environment, so don't ask any questions
  setupLibrary('test-library-name');
}

/**
 * Asks the user for the name of the library if it has been cloned into the
 * default directory, or if they want a different name to the one suggested
 */
async function libraryNameCreate() {
  try {
    const res: { library: string } = await prompt({
      type: 'input',
      name: 'library',
      initial: _suggestLibraryName(),
      message: 'What do you want the library to be called? (use kebab-case)',
      validate: (input: string) => /^[a-z0-9]+(\-[a-z0-9]+)*$/.test(input),
    });
    setupLibrary(res.library);
  } catch (error) {
    console.log(kleur.red('Sorry, there was an error building the workspace :('));
    process.exit(1);
  }
}

/**
 * Calls all of the functions needed to setup the library
 *
 * @param libraryName
 */
function setupLibrary(libraryName: string) {
  console.log(kleur.cyan('\nThanks for the info. The last few changes are being made... hang tight!\n\n'));

  // Get the Git username and email before the .git directory is removed
  const username = exec('git config user.name').stdout.trim();
  const usermail = exec('git config user.email').stdout.trim();

  modifyContents(libraryName, username, usermail);

  renameItems(libraryName);

  removeItems();

  finalize();

  console.log(kleur.cyan("OK, you're all set. Happy coding!! ;)\n"));
}

/**
 * Removes items from the project that aren't needed after the initial setup
 */
function removeItems() {
  console.log(kleur.white('Removed'));

  // The directories and files are combined here, to simplify the function,
  // as the 'rm' command checks the item type before attempting to remove it
  const rmItems = rmDirs.concat(rmFiles);
  rm(
    '-rf',
    rmItems.map((f) => path.resolve(__dirname, '..', f))
  );
  console.log(kleur.red(rmItems.join('\n')));

  console.log('\n');
}

/**
 * Updates the contents of the template files with the library name or user details
 *
 * @param libraryName
 * @param username
 * @param usermail
 */
function modifyContents(libraryName: string, username: string, usermail: string) {
  console.log(kleur.white('Modified'));

  const files = modifyFiles.map((f) => path.resolve(__dirname, '..', f));
  try {
    replace.sync({
      files,
      from: [/--libraryname--/g, /--username--/g, /--usermail--/g],
      to: [libraryName, username, usermail],
    });
    console.log(kleur.yellow(modifyFiles.join('\n')));
  } catch (error) {
    console.error('An error occurred modifying the file: ', error);
  }

  console.log('\n');
}

/**
 * Renames any template files to the new library name
 *
 * @param libraryName
 */
function renameItems(libraryName: string) {
  console.log(kleur.white('Renamed'));

  renameFiles.forEach(function (files) {
    // Files[0] is the current filename
    // Files[1] is the new name
    const newFilename = files[1].replace(/--libraryname--/g, libraryName);
    mv(path.resolve(__dirname, '..', files[0]), path.resolve(__dirname, '..', newFilename));
    console.log(kleur.cyan(files[0] + ' => ' + newFilename));
  });

  console.log('\n');
}

/**
 * Calls any external programs to finish setting up the library
 */
function finalize() {
  console.log(kleur.white('Finalizing'));

  // Recreate Git folder
  const gitInitOutput = exec('git init "' + path.resolve(__dirname, '..') + '"', {
    silent: true,
  }).stdout;
  console.log(kleur.green(gitInitOutput.replace(/(\n|\r)+/g, '')));

  // Remove post-install command
  const jsonPackage = path.resolve(__dirname, '..', 'package.json');
  const pkg = JSON.parse(readFileSync(jsonPackage) as any);

  // Note: Add items to remove from the package file here
  delete pkg.scripts.postinstall;

  console.log(kleur.green('Setting up git hooks'));
  exec('pnpx lefthook install');
  pkg.scripts.postinstall = 'lefthook install';
  writeFileSync(jsonPackage, JSON.stringify(pkg, null, 2));

  console.log(kleur.green('Postinstall script has been removed'));

  // Initialize Husky
  fork(path.resolve(__dirname, '..', 'node_modules', 'husky', 'bin', 'install'), { silent: true });
  console.log(kleur.green('Git hooks set up'));

  console.log('\n');
}
