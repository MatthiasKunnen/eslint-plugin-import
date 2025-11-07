'use strict';var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {return typeof obj;} : function (obj) {return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;};





var _contextCompat = require('eslint-module-utils/contextCompat');
var _ignore = require('eslint-module-utils/ignore');
var _resolve = require('eslint-module-utils/resolve');var _resolve2 = _interopRequireDefault(_resolve);
var _visit = require('eslint-module-utils/visit');var _visit2 = _interopRequireDefault(_visit);
var _path = require('path');
var _readPkgUp2 = require('eslint-module-utils/readPkgUp');var _readPkgUp3 = _interopRequireDefault(_readPkgUp2);

var _builder = require('../exportMap/builder');var _builder2 = _interopRequireDefault(_builder);
var _patternCapture = require('../exportMap/patternCapture');var _patternCapture2 = _interopRequireDefault(_patternCapture);
var _docsUrl = require('../docsUrl');var _docsUrl2 = _interopRequireDefault(_docsUrl);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { 'default': obj };}function _toConsumableArray(arr) {if (Array.isArray(arr)) {for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {arr2[i] = arr[i];}return arr2;} else {return Array.from(arr);}} /**
                                                                                                                                                                                                                                                                                                                                                                                 * @fileOverview Ensures that modules contain exports and/or all
                                                                                                                                                                                                                                                                                                                                                                                 * modules are consumed within other modules.
                                                                                                                                                                                                                                                                                                                                                                                 * @author René Fermann
                                                                                                                                                                                                                                                                                                                                                                                 */ /**
                                                                                                                                                                                                                                                                                                                                                                                     * Attempt to load the internal `FileEnumerator` class, which has existed in a couple
                                                                                                                                                                                                                                                                                                                                                                                     * of different places, depending on the version of `eslint`.  Try requiring it from both
                                                                                                                                                                                                                                                                                                                                                                                     * locations.
                                                                                                                                                                                                                                                                                                                                                                                     * @returns Returns the `FileEnumerator` class if its requirable, otherwise `undefined`.
                                                                                                                                                                                                                                                                                                                                                                                     */function requireFileEnumerator() {var FileEnumerator = void 0;

  // Try getting it from the eslint private / deprecated api
  try {var _require =
    require('eslint/use-at-your-own-risk');FileEnumerator = _require.FileEnumerator;
  } catch (e) {
    // Absorb this if it's MODULE_NOT_FOUND
    if (e.code !== 'MODULE_NOT_FOUND') {
      throw e;
    }

    // If not there, then try getting it from eslint/lib/cli-engine/file-enumerator (moved there in v6)
    try {var _require2 =
      require('eslint/lib/cli-engine/file-enumerator');FileEnumerator = _require2.FileEnumerator;
    } catch (e) {
      // Absorb this if it's MODULE_NOT_FOUND
      if (e.code !== 'MODULE_NOT_FOUND') {
        throw e;
      }
    }
  }
  return FileEnumerator;
}

/**
   * Given a FileEnumerator class, instantiate and load the list of files.
   * @param FileEnumerator the `FileEnumerator` class from `eslint`'s internal api
   * @param {string} src path to the src root
   * @param {string[]} extensions list of supported extensions
   * @returns {{ filename: string, ignored: boolean }[]} list of files to operate on
   */
function listFilesUsingFileEnumerator(FileEnumerator, src, extensions) {
  // We need to know whether this is being run with flat config in order to
  // determine how to report errors if FileEnumerator throws due to a lack of eslintrc.
  var
  ESLINT_USE_FLAT_CONFIG = process.env.ESLINT_USE_FLAT_CONFIG;

  // This condition is sufficient to test in v8, since the environment variable is necessary to turn on flat config
  var isUsingFlatConfig = ESLINT_USE_FLAT_CONFIG && process.env.ESLINT_USE_FLAT_CONFIG !== 'false';

  // In the case of using v9, we can check the `shouldUseFlatConfig` function
  // If this function is present, then we assume it's v9
  try {var _require3 =
    require('eslint/use-at-your-own-risk'),shouldUseFlatConfig = _require3.shouldUseFlatConfig;
    isUsingFlatConfig = shouldUseFlatConfig && ESLINT_USE_FLAT_CONFIG !== 'false';
  } catch (_) {
    // We don't want to throw here, since we only want to update the
    // boolean if the function is available.
  }

  var enumerator = new FileEnumerator({
    extensions: extensions });


  try {
    return Array.from(
    enumerator.iterateFiles(src),
    function (_ref) {var filePath = _ref.filePath,ignored = _ref.ignored;return { filename: filePath, ignored: ignored };});

  } catch (e) {
    // If we're using flat config, and FileEnumerator throws due to a lack of eslintrc,
    // then we want to throw an error so that the user knows about this rule's reliance on
    // the legacy config.
    if (
    isUsingFlatConfig &&
    e.message.includes('No ESLint configuration found'))
    {
      throw new Error('\nDue to the exclusion of certain internal ESLint APIs when using flat config,\nthe import/no-unused-modules rule requires an .eslintrc file to know which\nfiles to ignore (even when using flat config).\nThe .eslintrc file only needs to contain "ignorePatterns", or can be empty if\nyou do not want to ignore any files.\n\nSee https://github.com/import-js/eslint-plugin-import/issues/3079\nfor additional context.\n');









    }
    // If this isn't the case, then we'll just let the error bubble up
    throw e;
  }
}

/**
   * Attempt to require old versions of the file enumeration capability from v6 `eslint` and earlier, and use
   * those functions to provide the list of files to operate on
   * @param {string} src path to the src root
   * @param {string[]} extensions list of supported extensions
   * @returns {string[]} list of files to operate on
   */
function listFilesWithLegacyFunctions(src, extensions) {
  try {
    // eslint/lib/util/glob-util has been moved to eslint/lib/util/glob-utils with version 5.3
    var _require4 = require('eslint/lib/util/glob-utils'),originalListFilesToProcess = _require4.listFilesToProcess;
    // Prevent passing invalid options (extensions array) to old versions of the function.
    // https://github.com/eslint/eslint/blob/v5.16.0/lib/util/glob-utils.js#L178-L280
    // https://github.com/eslint/eslint/blob/v5.2.0/lib/util/glob-util.js#L174-L269

    return originalListFilesToProcess(src, {
      extensions: extensions });

  } catch (e) {
    // Absorb this if it's MODULE_NOT_FOUND
    if (e.code !== 'MODULE_NOT_FOUND') {
      throw e;
    }

    // Last place to try (pre v5.3)
    var _require5 =

    require('eslint/lib/util/glob-util'),_originalListFilesToProcess = _require5.listFilesToProcess;
    var patterns = src.concat(
    src.flatMap(
    function (pattern) {return extensions.map(function (extension) {return (/\*\*|\*\./.test(pattern) ? pattern : String(pattern) + '/**/*' + String(extension));});}));



    return _originalListFilesToProcess(patterns);
  }
}

/**
   * Given a src pattern and list of supported extensions, return a list of files to process
   * with this rule.
   * @param {string} src - file, directory, or glob pattern of files to act on
   * @param {string[]} extensions - list of supported file extensions
   * @returns {string[] | { filename: string, ignored: boolean }[]} the list of files that this rule will evaluate.
   */
function listFilesToProcess(src, extensions) {
  var FileEnumerator = requireFileEnumerator();

  // If we got the FileEnumerator, then let's go with that
  if (FileEnumerator) {
    return listFilesUsingFileEnumerator(FileEnumerator, src, extensions);
  }
  // If not, then we can try even older versions of this capability (listFilesToProcess)
  return listFilesWithLegacyFunctions(src, extensions);
}

var EXPORT_DEFAULT_DECLARATION = 'ExportDefaultDeclaration';
var EXPORT_NAMED_DECLARATION = 'ExportNamedDeclaration';
var EXPORT_ALL_DECLARATION = 'ExportAllDeclaration';
var IMPORT_DECLARATION = 'ImportDeclaration';
var IMPORT_NAMESPACE_SPECIFIER = 'ImportNamespaceSpecifier';
var IMPORT_DEFAULT_SPECIFIER = 'ImportDefaultSpecifier';
var VARIABLE_DECLARATION = 'VariableDeclaration';
var FUNCTION_DECLARATION = 'FunctionDeclaration';
var CLASS_DECLARATION = 'ClassDeclaration';
var IDENTIFIER = 'Identifier';
var OBJECT_PATTERN = 'ObjectPattern';
var ARRAY_PATTERN = 'ArrayPattern';
var TS_INTERFACE_DECLARATION = 'TSInterfaceDeclaration';
var TS_TYPE_ALIAS_DECLARATION = 'TSTypeAliasDeclaration';
var TS_ENUM_DECLARATION = 'TSEnumDeclaration';
var DEFAULT = 'default';

function forEachDeclarationIdentifier(declaration, cb) {
  if (declaration) {
    var isTypeDeclaration = declaration.type === TS_INTERFACE_DECLARATION ||
    declaration.type === TS_TYPE_ALIAS_DECLARATION ||
    declaration.type === TS_ENUM_DECLARATION;

    if (
    declaration.type === FUNCTION_DECLARATION ||
    declaration.type === CLASS_DECLARATION ||
    isTypeDeclaration)
    {
      cb(declaration.id.name, isTypeDeclaration);
    } else if (declaration.type === VARIABLE_DECLARATION) {
      declaration.declarations.forEach(function (_ref2) {var id = _ref2.id;
        if (id.type === OBJECT_PATTERN) {
          (0, _patternCapture2['default'])(id, function (pattern) {
            if (pattern.type === IDENTIFIER) {
              cb(pattern.name, false);
            }
          });
        } else if (id.type === ARRAY_PATTERN) {
          id.elements.forEach(function (_ref3) {var name = _ref3.name;
            cb(name, false);
          });
        } else {
          cb(id.name, false);
        }
      });
    }
  }
}

/**
   * List of imports per file.
   *
   * Represented by a two-level Map to a Set of identifiers. The upper-level Map
   * keys are the paths to the modules containing the imports, while the
   * lower-level Map keys are the paths to the files which are being imported
   * from. Lastly, the Set of identifiers contains either names being imported
   * or a special AST node name listed above (e.g ImportDefaultSpecifier).
   *
   * For example, if we have a file named foo.js containing:
   *
   *   import { o2 } from './bar.js';
   *
   * Then we will have a structure that looks like:
   *
   *   Map { 'foo.js' => Map { 'bar.js' => Set { 'o2' } } }
   *
   * @type {Map<string, Map<string, Set<string>>>}
   */
var importList = new Map();

/**
                             * List of exports per file.
                             *
                             * Represented by a two-level Map to an object of metadata. The upper-level Map
                             * keys are the paths to the modules containing the exports, while the
                             * lower-level Map keys are the specific identifiers or special AST node names
                             * being exported. The leaf-level metadata object at the moment only contains a
                             * `whereUsed` property, which contains a Set of paths to modules that import
                             * the name.
                             *
                             * For example, if we have a file named bar.js containing the following exports:
                             *
                             *   const o2 = 'bar';
                             *   export { o2 };
                             *
                             * And a file named foo.js containing the following import:
                             *
                             *   import { o2 } from './bar.js';
                             *
                             * Then we will have a structure that looks like:
                             *
                             *   Map { 'bar.js' => Map { 'o2' => { whereUsed: Set { 'foo.js' } } } }
                             *
                             * @type {Map<string, Map<string, object>>}
                             */
var exportList = new Map();

var visitorKeyMap = new Map();

/** @type {Set<string>} */
var ignoredFiles = new Set();
var filesOutsideSrc = new Set();

var isNodeModule = function isNodeModule(path) {return (/\/(node_modules)\//.test(path));};

/**
                                                                                             * read all files matching the patterns in src and ignoreExports
                                                                                             *
                                                                                             * return all files matching src pattern, which are not matching the ignoreExports pattern
                                                                                             * @type {(src: string, ignoreExports: string, context: import('eslint').Rule.RuleContext) => Set<string>}
                                                                                             */
function resolveFiles(src, ignoreExports, context) {
  var extensions = Array.from((0, _ignore.getFileExtensions)(context.settings));

  var srcFileList = listFilesToProcess(src, extensions);

  // prepare list of ignored files
  var ignoredFilesList = listFilesToProcess(ignoreExports, extensions);

  // The modern api will return a list of file paths, rather than an object
  if (ignoredFilesList.length && typeof ignoredFilesList[0] === 'string') {
    ignoredFilesList.forEach(function (filename) {return ignoredFiles.add(filename);});
  } else {
    ignoredFilesList.forEach(function (_ref4) {var filename = _ref4.filename;return ignoredFiles.add(filename);});
  }

  // prepare list of source files, don't consider files from node_modules
  var resolvedFiles = srcFileList.length && typeof srcFileList[0] === 'string' ?
  srcFileList.filter(function (filePath) {return !isNodeModule(filePath);}) :
  srcFileList.flatMap(function (_ref5) {var filename = _ref5.filename;return isNodeModule(filename) ? [] : filename;});

  return new Set(resolvedFiles);
}

/**
   * parse all source files and build up 2 maps containing the existing imports and exports
   */
var prepareImportsAndExports = function prepareImportsAndExports(srcFiles, context) {
  var exportAll = new Map();
  srcFiles.forEach(function (file) {
    var exports = new Map();
    var imports = new Map();
    var currentExports = _builder2['default'].get(file, context);
    if (currentExports) {var

      dependencies =




      currentExports.dependencies,reexports = currentExports.reexports,localImportList = currentExports.imports,namespace = currentExports.namespace,visitorKeys = currentExports.visitorKeys;

      visitorKeyMap.set(file, visitorKeys);
      // dependencies === export * from
      var currentExportAll = new Set();
      dependencies.forEach(function (getDependency) {
        var dependency = getDependency();
        if (dependency === null) {
          return;
        }

        currentExportAll.add(dependency.path);
      });
      exportAll.set(file, currentExportAll);

      reexports.forEach(function (value, key) {
        if (key === DEFAULT) {
          exports.set(IMPORT_DEFAULT_SPECIFIER, { whereUsed: new Set() });
        } else {
          exports.set(key, { whereUsed: new Set() });
        }
        var reexport = value.getImport();
        if (!reexport) {
          return;
        }
        var localImport = imports.get(reexport.path);
        var currentValue = void 0;
        if (value.local === DEFAULT) {
          currentValue = IMPORT_DEFAULT_SPECIFIER;
        } else {
          currentValue = value.local;
        }
        if (typeof localImport !== 'undefined') {
          localImport = new Set([].concat(_toConsumableArray(localImport), [currentValue]));
        } else {
          localImport = new Set([currentValue]);
        }
        imports.set(reexport.path, localImport);
      });

      localImportList.forEach(function (value, key) {
        if (isNodeModule(key)) {
          return;
        }
        var localImport = imports.get(key) || new Set();
        value.declarations.forEach(function (_ref6) {var importedSpecifiers = _ref6.importedSpecifiers;
          importedSpecifiers.forEach(function (specifier) {
            localImport.add(specifier);
          });
        });
        imports.set(key, localImport);
      });
      importList.set(file, imports);

      // build up export list only, if file is not ignored
      if (ignoredFiles.has(file)) {
        return;
      }
      namespace.forEach(function (value, key) {
        if (key === DEFAULT) {
          exports.set(IMPORT_DEFAULT_SPECIFIER, { whereUsed: new Set() });
        } else {
          exports.set(key, { whereUsed: new Set() });
        }
      });
    }
    exports.set(EXPORT_ALL_DECLARATION, { whereUsed: new Set() });
    exports.set(IMPORT_NAMESPACE_SPECIFIER, { whereUsed: new Set() });
    exportList.set(file, exports);
  });
  exportAll.forEach(function (value, key) {
    value.forEach(function (val) {
      var currentExports = exportList.get(val);
      if (currentExports) {
        var currentExport = currentExports.get(EXPORT_ALL_DECLARATION);
        currentExport.whereUsed.add(key);
      }
    });
  });
};

/**
    * traverse through all imports and add the respective path to the whereUsed-list
    * of the corresponding export
    */
var determineUsage = function determineUsage() {
  importList.forEach(function (listValue, listKey) {
    listValue.forEach(function (value, key) {
      var exports = exportList.get(key);
      if (typeof exports !== 'undefined') {
        value.forEach(function (currentImport) {
          var specifier = void 0;
          if (currentImport === IMPORT_NAMESPACE_SPECIFIER) {
            specifier = IMPORT_NAMESPACE_SPECIFIER;
          } else if (currentImport === IMPORT_DEFAULT_SPECIFIER) {
            specifier = IMPORT_DEFAULT_SPECIFIER;
          } else {
            specifier = currentImport;
          }
          if (typeof specifier !== 'undefined') {
            var exportStatement = exports.get(specifier);
            if (typeof exportStatement !== 'undefined') {var
              whereUsed = exportStatement.whereUsed;
              whereUsed.add(listKey);
              exports.set(specifier, { whereUsed: whereUsed });
            }
          }
        });
      }
    });
  });
};

var getSrc = function getSrc(src) {
  if (src) {
    return src;
  }
  return [process.cwd()];
};

/**
    * prepare the lists of existing imports and exports - should only be executed once at
    * the start of a new eslint run
    */
/** @type {Set<string>} */
var srcFiles = void 0;
var lastPrepareKey = void 0;
var doPreparation = function doPreparation(src, ignoreExports, context) {
  var prepareKey = JSON.stringify({
    src: (src || []).sort(),
    ignoreExports: (ignoreExports || []).sort(),
    extensions: Array.from((0, _ignore.getFileExtensions)(context.settings)).sort() });

  if (prepareKey === lastPrepareKey) {
    return;
  }

  importList.clear();
  exportList.clear();
  ignoredFiles.clear();
  filesOutsideSrc.clear();

  srcFiles = resolveFiles(getSrc(src), ignoreExports, context);
  prepareImportsAndExports(srcFiles, context);
  determineUsage();
  lastPrepareKey = prepareKey;
};

var newNamespaceImportExists = function newNamespaceImportExists(specifiers) {return specifiers.some(function (_ref7) {var type = _ref7.type;return type === IMPORT_NAMESPACE_SPECIFIER;});};

var newDefaultImportExists = function newDefaultImportExists(specifiers) {return specifiers.some(function (_ref8) {var type = _ref8.type;return type === IMPORT_DEFAULT_SPECIFIER;});};

var fileIsInPkg = function fileIsInPkg(file) {var _readPkgUp =
  (0, _readPkgUp3['default'])({ cwd: file }),path = _readPkgUp.path,pkg = _readPkgUp.pkg;
  var basePath = (0, _path.dirname)(path);

  var checkPkgFieldString = function checkPkgFieldString(pkgField) {
    if ((0, _path.join)(basePath, pkgField) === file) {
      return true;
    }
  };

  var checkPkgFieldObject = function checkPkgFieldObject(pkgField) {
    var pkgFieldFiles = Object.values(pkgField).flatMap(function (value) {return typeof value === 'boolean' ? [] : (0, _path.join)(basePath, value);});

    if (pkgFieldFiles.includes(file)) {
      return true;
    }
  };

  var checkPkgField = function checkPkgField(pkgField) {
    if (typeof pkgField === 'string') {
      return checkPkgFieldString(pkgField);
    }

    if ((typeof pkgField === 'undefined' ? 'undefined' : _typeof(pkgField)) === 'object') {
      return checkPkgFieldObject(pkgField);
    }
  };

  if (pkg['private'] === true) {
    return false;
  }

  if (pkg.bin) {
    if (checkPkgField(pkg.bin)) {
      return true;
    }
  }

  if (pkg.browser) {
    if (checkPkgField(pkg.browser)) {
      return true;
    }
  }

  if (pkg.main) {
    if (checkPkgFieldString(pkg.main)) {
      return true;
    }
  }

  return false;
};

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      category: 'Helpful warnings',
      description: 'Forbid modules without exports, or exports without matching import in another module.',
      url: (0, _docsUrl2['default'])('no-unused-modules') },

    schema: [{
      properties: {
        src: {
          description: 'files/paths to be analyzed (only for unused exports)',
          type: 'array',
          uniqueItems: true,
          items: {
            type: 'string',
            minLength: 1 } },


        ignoreExports: {
          description: 'files/paths for which unused exports will not be reported (e.g module entry points)',
          type: 'array',
          uniqueItems: true,
          items: {
            type: 'string',
            minLength: 1 } },


        missingExports: {
          description: 'report modules without any exports',
          type: 'boolean' },

        unusedExports: {
          description: 'report exports without any usage',
          type: 'boolean' },

        ignoreUnusedTypeExports: {
          description: 'ignore type exports without any usage',
          type: 'boolean' } },


      anyOf: [
      {
        properties: {
          unusedExports: { 'enum': [true] },
          src: {
            minItems: 1 } },


        required: ['unusedExports'] },

      {
        properties: {
          missingExports: { 'enum': [true] } },

        required: ['missingExports'] }] }] },





  create: function () {function create(context) {var _ref9 =






      context.options[0] || {},src = _ref9.src,_ref9$ignoreExports = _ref9.ignoreExports,ignoreExports = _ref9$ignoreExports === undefined ? [] : _ref9$ignoreExports,missingExports = _ref9.missingExports,unusedExports = _ref9.unusedExports,ignoreUnusedTypeExports = _ref9.ignoreUnusedTypeExports;

      if (unusedExports) {
        doPreparation(src, ignoreExports, context);
      }

      var file = (0, _contextCompat.getPhysicalFilename)(context);

      var checkExportPresence = function () {function checkExportPresence(node) {
          if (!missingExports) {
            return;
          }

          if (ignoredFiles.has(file)) {
            return;
          }

          var exportCount = exportList.get(file);
          var exportAll = exportCount.get(EXPORT_ALL_DECLARATION);
          var namespaceImports = exportCount.get(IMPORT_NAMESPACE_SPECIFIER);

          exportCount['delete'](EXPORT_ALL_DECLARATION);
          exportCount['delete'](IMPORT_NAMESPACE_SPECIFIER);
          if (exportCount.size < 1) {
            // node.body[0] === 'undefined' only happens, if everything is commented out in the file
            // being linted
            context.report(node.body[0] ? node.body[0] : node, 'No exports found');
          }
          exportCount.set(EXPORT_ALL_DECLARATION, exportAll);
          exportCount.set(IMPORT_NAMESPACE_SPECIFIER, namespaceImports);
        }return checkExportPresence;}();

      var checkUsage = function () {function checkUsage(node, exportedValue, isTypeExport) {
          if (!unusedExports) {
            return;
          }

          if (isTypeExport && ignoreUnusedTypeExports) {
            return;
          }

          if (ignoredFiles.has(file)) {
            return;
          }

          if (fileIsInPkg(file)) {
            return;
          }

          if (filesOutsideSrc.has(file)) {
            return;
          }

          // make sure file to be linted is included in source files
          if (!srcFiles.has(file)) {
            srcFiles = resolveFiles(getSrc(src), ignoreExports, context);
            if (!srcFiles.has(file)) {
              filesOutsideSrc.add(file);
              return;
            }
          }

          exports = exportList.get(file);

          if (!exports) {
            console.error('file `' + String(file) + '` has no exports. Please update to the latest, and if it still happens, report this on https://github.com/import-js/eslint-plugin-import/issues/2866!');
          }

          // special case: export * from
          var exportAll = exports.get(EXPORT_ALL_DECLARATION);
          if (typeof exportAll !== 'undefined' && exportedValue !== IMPORT_DEFAULT_SPECIFIER) {
            if (exportAll.whereUsed.size > 0) {
              return;
            }
          }

          // special case: namespace import
          var namespaceImports = exports.get(IMPORT_NAMESPACE_SPECIFIER);
          if (typeof namespaceImports !== 'undefined') {
            if (namespaceImports.whereUsed.size > 0) {
              return;
            }
          }

          // exportsList will always map any imported value of 'default' to 'ImportDefaultSpecifier'
          var exportsKey = exportedValue === DEFAULT ? IMPORT_DEFAULT_SPECIFIER : exportedValue;

          var exportStatement = exports.get(exportsKey);

          var value = exportsKey === IMPORT_DEFAULT_SPECIFIER ? DEFAULT : exportsKey;

          if (typeof exportStatement !== 'undefined') {
            if (exportStatement.whereUsed.size < 1) {
              context.report(
              node, 'exported declaration \'' +
              value + '\' not used within other modules');

            }
          } else {
            context.report(
            node, 'exported declaration \'' +
            value + '\' not used within other modules');

          }
        }return checkUsage;}();

      /**
                                 * only useful for tools like vscode-eslint
                                 *
                                 * update lists of existing exports during runtime
                                 */
      var updateExportUsage = function () {function updateExportUsage(node) {
          if (ignoredFiles.has(file)) {
            return;
          }

          var exports = exportList.get(file);

          // new module has been created during runtime
          // include it in further processing
          if (typeof exports === 'undefined') {
            exports = new Map();
          }

          var newExports = new Map();
          var newExportIdentifiers = new Set();

          node.body.forEach(function (_ref10) {var type = _ref10.type,declaration = _ref10.declaration,specifiers = _ref10.specifiers;
            if (type === EXPORT_DEFAULT_DECLARATION) {
              newExportIdentifiers.add(IMPORT_DEFAULT_SPECIFIER);
            }
            if (type === EXPORT_NAMED_DECLARATION) {
              if (specifiers.length > 0) {
                specifiers.forEach(function (specifier) {
                  if (specifier.exported) {
                    newExportIdentifiers.add(specifier.exported.name || specifier.exported.value);
                  }
                });
              }
              forEachDeclarationIdentifier(declaration, function (name) {
                newExportIdentifiers.add(name);
              });
            }
          });

          // old exports exist within list of new exports identifiers: add to map of new exports
          exports.forEach(function (value, key) {
            if (newExportIdentifiers.has(key)) {
              newExports.set(key, value);
            }
          });

          // new export identifiers added: add to map of new exports
          newExportIdentifiers.forEach(function (key) {
            if (!exports.has(key)) {
              newExports.set(key, { whereUsed: new Set() });
            }
          });

          // preserve information about namespace imports
          var exportAll = exports.get(EXPORT_ALL_DECLARATION);
          var namespaceImports = exports.get(IMPORT_NAMESPACE_SPECIFIER);

          if (typeof namespaceImports === 'undefined') {
            namespaceImports = { whereUsed: new Set() };
          }

          newExports.set(EXPORT_ALL_DECLARATION, exportAll);
          newExports.set(IMPORT_NAMESPACE_SPECIFIER, namespaceImports);
          exportList.set(file, newExports);
        }return updateExportUsage;}();

      /**
                                        * only useful for tools like vscode-eslint
                                        *
                                        * update lists of existing imports during runtime
                                        */
      var updateImportUsage = function () {function updateImportUsage(node) {
          if (!unusedExports) {
            return;
          }

          var oldImportPaths = importList.get(file);
          if (typeof oldImportPaths === 'undefined') {
            oldImportPaths = new Map();
          }

          var oldNamespaceImports = new Set();
          var newNamespaceImports = new Set();

          var oldExportAll = new Set();
          var newExportAll = new Set();

          var oldDefaultImports = new Set();
          var newDefaultImports = new Set();

          var oldImports = new Map();
          var newImports = new Map();
          oldImportPaths.forEach(function (value, key) {
            if (value.has(EXPORT_ALL_DECLARATION)) {
              oldExportAll.add(key);
            }
            if (value.has(IMPORT_NAMESPACE_SPECIFIER)) {
              oldNamespaceImports.add(key);
            }
            if (value.has(IMPORT_DEFAULT_SPECIFIER)) {
              oldDefaultImports.add(key);
            }
            value.forEach(function (val) {
              if (
              val !== IMPORT_NAMESPACE_SPECIFIER &&
              val !== IMPORT_DEFAULT_SPECIFIER)
              {
                oldImports.set(val, key);
              }
            });
          });

          function processDynamicImport(source) {
            if (source.type !== 'Literal') {
              return null;
            }
            var p = (0, _resolve2['default'])(source.value, context);
            if (p == null) {
              return null;
            }
            newNamespaceImports.add(p);
          }

          (0, _visit2['default'])(node, visitorKeyMap.get(file), {
            ImportExpression: function () {function ImportExpression(child) {
                processDynamicImport(child.source);
              }return ImportExpression;}(),
            CallExpression: function () {function CallExpression(child) {
                if (child.callee.type === 'Import') {
                  processDynamicImport(child.arguments[0]);
                }
              }return CallExpression;}() });


          node.body.forEach(function (astNode) {
            var resolvedPath = void 0;

            // support for export { value } from 'module'
            if (astNode.type === EXPORT_NAMED_DECLARATION) {
              if (astNode.source) {
                resolvedPath = (0, _resolve2['default'])(astNode.source.raw.replace(/('|")/g, ''), context);
                astNode.specifiers.forEach(function (specifier) {
                  var name = specifier.local.name || specifier.local.value;
                  if (name === DEFAULT) {
                    newDefaultImports.add(resolvedPath);
                  } else {
                    newImports.set(name, resolvedPath);
                  }
                });
              }
            }

            if (astNode.type === EXPORT_ALL_DECLARATION) {
              resolvedPath = (0, _resolve2['default'])(astNode.source.raw.replace(/('|")/g, ''), context);
              newExportAll.add(resolvedPath);
            }

            if (astNode.type === IMPORT_DECLARATION) {
              resolvedPath = (0, _resolve2['default'])(astNode.source.raw.replace(/('|")/g, ''), context);
              if (!resolvedPath) {
                return;
              }

              if (isNodeModule(resolvedPath)) {
                return;
              }

              if (newNamespaceImportExists(astNode.specifiers)) {
                newNamespaceImports.add(resolvedPath);
              }

              if (newDefaultImportExists(astNode.specifiers)) {
                newDefaultImports.add(resolvedPath);
              }

              astNode.specifiers.
              filter(function (specifier) {return specifier.type !== IMPORT_DEFAULT_SPECIFIER && specifier.type !== IMPORT_NAMESPACE_SPECIFIER;}).
              forEach(function (specifier) {
                newImports.set(specifier.imported.name || specifier.imported.value, resolvedPath);
              });
            }
          });

          newExportAll.forEach(function (value) {
            if (!oldExportAll.has(value)) {
              var imports = oldImportPaths.get(value);
              if (typeof imports === 'undefined') {
                imports = new Set();
              }
              imports.add(EXPORT_ALL_DECLARATION);
              oldImportPaths.set(value, imports);

              var _exports = exportList.get(value);
              var currentExport = void 0;
              if (typeof _exports !== 'undefined') {
                currentExport = _exports.get(EXPORT_ALL_DECLARATION);
              } else {
                _exports = new Map();
                exportList.set(value, _exports);
              }

              if (typeof currentExport !== 'undefined') {
                currentExport.whereUsed.add(file);
              } else {
                var whereUsed = new Set();
                whereUsed.add(file);
                _exports.set(EXPORT_ALL_DECLARATION, { whereUsed: whereUsed });
              }
            }
          });

          oldExportAll.forEach(function (value) {
            if (!newExportAll.has(value)) {
              var imports = oldImportPaths.get(value);
              imports['delete'](EXPORT_ALL_DECLARATION);

              var _exports2 = exportList.get(value);
              if (typeof _exports2 !== 'undefined') {
                var currentExport = _exports2.get(EXPORT_ALL_DECLARATION);
                if (typeof currentExport !== 'undefined') {
                  currentExport.whereUsed['delete'](file);
                }
              }
            }
          });

          newDefaultImports.forEach(function (value) {
            if (!oldDefaultImports.has(value)) {
              var imports = oldImportPaths.get(value);
              if (typeof imports === 'undefined') {
                imports = new Set();
              }
              imports.add(IMPORT_DEFAULT_SPECIFIER);
              oldImportPaths.set(value, imports);

              var _exports3 = exportList.get(value);
              var currentExport = void 0;
              if (typeof _exports3 !== 'undefined') {
                currentExport = _exports3.get(IMPORT_DEFAULT_SPECIFIER);
              } else {
                _exports3 = new Map();
                exportList.set(value, _exports3);
              }

              if (typeof currentExport !== 'undefined') {
                currentExport.whereUsed.add(file);
              } else {
                var whereUsed = new Set();
                whereUsed.add(file);
                _exports3.set(IMPORT_DEFAULT_SPECIFIER, { whereUsed: whereUsed });
              }
            }
          });

          oldDefaultImports.forEach(function (value) {
            if (!newDefaultImports.has(value)) {
              var imports = oldImportPaths.get(value);
              imports['delete'](IMPORT_DEFAULT_SPECIFIER);

              var _exports4 = exportList.get(value);
              if (typeof _exports4 !== 'undefined') {
                var currentExport = _exports4.get(IMPORT_DEFAULT_SPECIFIER);
                if (typeof currentExport !== 'undefined') {
                  currentExport.whereUsed['delete'](file);
                }
              }
            }
          });

          newNamespaceImports.forEach(function (value) {
            if (!oldNamespaceImports.has(value)) {
              var imports = oldImportPaths.get(value);
              if (typeof imports === 'undefined') {
                imports = new Set();
              }
              imports.add(IMPORT_NAMESPACE_SPECIFIER);
              oldImportPaths.set(value, imports);

              var _exports5 = exportList.get(value);
              var currentExport = void 0;
              if (typeof _exports5 !== 'undefined') {
                currentExport = _exports5.get(IMPORT_NAMESPACE_SPECIFIER);
              } else {
                _exports5 = new Map();
                exportList.set(value, _exports5);
              }

              if (typeof currentExport !== 'undefined') {
                currentExport.whereUsed.add(file);
              } else {
                var whereUsed = new Set();
                whereUsed.add(file);
                _exports5.set(IMPORT_NAMESPACE_SPECIFIER, { whereUsed: whereUsed });
              }
            }
          });

          oldNamespaceImports.forEach(function (value) {
            if (!newNamespaceImports.has(value)) {
              var imports = oldImportPaths.get(value);
              imports['delete'](IMPORT_NAMESPACE_SPECIFIER);

              var _exports6 = exportList.get(value);
              if (typeof _exports6 !== 'undefined') {
                var currentExport = _exports6.get(IMPORT_NAMESPACE_SPECIFIER);
                if (typeof currentExport !== 'undefined') {
                  currentExport.whereUsed['delete'](file);
                }
              }
            }
          });

          newImports.forEach(function (value, key) {
            if (!oldImports.has(key)) {
              var imports = oldImportPaths.get(value);
              if (typeof imports === 'undefined') {
                imports = new Set();
              }
              imports.add(key);
              oldImportPaths.set(value, imports);

              var _exports7 = exportList.get(value);
              var currentExport = void 0;
              if (typeof _exports7 !== 'undefined') {
                currentExport = _exports7.get(key);
              } else {
                _exports7 = new Map();
                exportList.set(value, _exports7);
              }

              if (typeof currentExport !== 'undefined') {
                currentExport.whereUsed.add(file);
              } else {
                var whereUsed = new Set();
                whereUsed.add(file);
                _exports7.set(key, { whereUsed: whereUsed });
              }
            }
          });

          oldImports.forEach(function (value, key) {
            if (!newImports.has(key)) {
              var imports = oldImportPaths.get(value);
              imports['delete'](key);

              var _exports8 = exportList.get(value);
              if (typeof _exports8 !== 'undefined') {
                var currentExport = _exports8.get(key);
                if (typeof currentExport !== 'undefined') {
                  currentExport.whereUsed['delete'](file);
                }
              }
            }
          });
        }return updateImportUsage;}();

      return {
        'Program:exit': function () {function ProgramExit(node) {
            updateExportUsage(node);
            updateImportUsage(node);
            checkExportPresence(node);
          }return ProgramExit;}(),
        ExportDefaultDeclaration: function () {function ExportDefaultDeclaration(node) {
            checkUsage(node, IMPORT_DEFAULT_SPECIFIER, false);
          }return ExportDefaultDeclaration;}(),
        ExportNamedDeclaration: function () {function ExportNamedDeclaration(node) {
            node.specifiers.forEach(function (specifier) {
              checkUsage(specifier, specifier.exported.name || specifier.exported.value, false);
            });
            forEachDeclarationIdentifier(node.declaration, function (name, isTypeExport) {
              checkUsage(node, name, isTypeExport);
            });
          }return ExportNamedDeclaration;}() };

    }return create;}() };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ydWxlcy9uby11bnVzZWQtbW9kdWxlcy5qcyJdLCJuYW1lcyI6WyJyZXF1aXJlRmlsZUVudW1lcmF0b3IiLCJGaWxlRW51bWVyYXRvciIsInJlcXVpcmUiLCJlIiwiY29kZSIsImxpc3RGaWxlc1VzaW5nRmlsZUVudW1lcmF0b3IiLCJzcmMiLCJleHRlbnNpb25zIiwiRVNMSU5UX1VTRV9GTEFUX0NPTkZJRyIsInByb2Nlc3MiLCJlbnYiLCJpc1VzaW5nRmxhdENvbmZpZyIsInNob3VsZFVzZUZsYXRDb25maWciLCJfIiwiZW51bWVyYXRvciIsIkFycmF5IiwiZnJvbSIsIml0ZXJhdGVGaWxlcyIsImZpbGVQYXRoIiwiaWdub3JlZCIsImZpbGVuYW1lIiwibWVzc2FnZSIsImluY2x1ZGVzIiwiRXJyb3IiLCJsaXN0RmlsZXNXaXRoTGVnYWN5RnVuY3Rpb25zIiwib3JpZ2luYWxMaXN0RmlsZXNUb1Byb2Nlc3MiLCJsaXN0RmlsZXNUb1Byb2Nlc3MiLCJwYXR0ZXJucyIsImNvbmNhdCIsImZsYXRNYXAiLCJwYXR0ZXJuIiwibWFwIiwiZXh0ZW5zaW9uIiwidGVzdCIsIkVYUE9SVF9ERUZBVUxUX0RFQ0xBUkFUSU9OIiwiRVhQT1JUX05BTUVEX0RFQ0xBUkFUSU9OIiwiRVhQT1JUX0FMTF9ERUNMQVJBVElPTiIsIklNUE9SVF9ERUNMQVJBVElPTiIsIklNUE9SVF9OQU1FU1BBQ0VfU1BFQ0lGSUVSIiwiSU1QT1JUX0RFRkFVTFRfU1BFQ0lGSUVSIiwiVkFSSUFCTEVfREVDTEFSQVRJT04iLCJGVU5DVElPTl9ERUNMQVJBVElPTiIsIkNMQVNTX0RFQ0xBUkFUSU9OIiwiSURFTlRJRklFUiIsIk9CSkVDVF9QQVRURVJOIiwiQVJSQVlfUEFUVEVSTiIsIlRTX0lOVEVSRkFDRV9ERUNMQVJBVElPTiIsIlRTX1RZUEVfQUxJQVNfREVDTEFSQVRJT04iLCJUU19FTlVNX0RFQ0xBUkFUSU9OIiwiREVGQVVMVCIsImZvckVhY2hEZWNsYXJhdGlvbklkZW50aWZpZXIiLCJkZWNsYXJhdGlvbiIsImNiIiwiaXNUeXBlRGVjbGFyYXRpb24iLCJ0eXBlIiwiaWQiLCJuYW1lIiwiZGVjbGFyYXRpb25zIiwiZm9yRWFjaCIsImVsZW1lbnRzIiwiaW1wb3J0TGlzdCIsIk1hcCIsImV4cG9ydExpc3QiLCJ2aXNpdG9yS2V5TWFwIiwiaWdub3JlZEZpbGVzIiwiU2V0IiwiZmlsZXNPdXRzaWRlU3JjIiwiaXNOb2RlTW9kdWxlIiwicGF0aCIsInJlc29sdmVGaWxlcyIsImlnbm9yZUV4cG9ydHMiLCJjb250ZXh0Iiwic2V0dGluZ3MiLCJzcmNGaWxlTGlzdCIsImlnbm9yZWRGaWxlc0xpc3QiLCJsZW5ndGgiLCJhZGQiLCJyZXNvbHZlZEZpbGVzIiwiZmlsdGVyIiwicHJlcGFyZUltcG9ydHNBbmRFeHBvcnRzIiwic3JjRmlsZXMiLCJleHBvcnRBbGwiLCJmaWxlIiwiZXhwb3J0cyIsImltcG9ydHMiLCJjdXJyZW50RXhwb3J0cyIsIkV4cG9ydE1hcEJ1aWxkZXIiLCJnZXQiLCJkZXBlbmRlbmNpZXMiLCJyZWV4cG9ydHMiLCJsb2NhbEltcG9ydExpc3QiLCJuYW1lc3BhY2UiLCJ2aXNpdG9yS2V5cyIsInNldCIsImN1cnJlbnRFeHBvcnRBbGwiLCJnZXREZXBlbmRlbmN5IiwiZGVwZW5kZW5jeSIsInZhbHVlIiwia2V5Iiwid2hlcmVVc2VkIiwicmVleHBvcnQiLCJnZXRJbXBvcnQiLCJsb2NhbEltcG9ydCIsImN1cnJlbnRWYWx1ZSIsImxvY2FsIiwiaW1wb3J0ZWRTcGVjaWZpZXJzIiwic3BlY2lmaWVyIiwiaGFzIiwidmFsIiwiY3VycmVudEV4cG9ydCIsImRldGVybWluZVVzYWdlIiwibGlzdFZhbHVlIiwibGlzdEtleSIsImN1cnJlbnRJbXBvcnQiLCJleHBvcnRTdGF0ZW1lbnQiLCJnZXRTcmMiLCJjd2QiLCJsYXN0UHJlcGFyZUtleSIsImRvUHJlcGFyYXRpb24iLCJwcmVwYXJlS2V5IiwiSlNPTiIsInN0cmluZ2lmeSIsInNvcnQiLCJjbGVhciIsIm5ld05hbWVzcGFjZUltcG9ydEV4aXN0cyIsInNwZWNpZmllcnMiLCJzb21lIiwibmV3RGVmYXVsdEltcG9ydEV4aXN0cyIsImZpbGVJc0luUGtnIiwicGtnIiwiYmFzZVBhdGgiLCJjaGVja1BrZ0ZpZWxkU3RyaW5nIiwicGtnRmllbGQiLCJjaGVja1BrZ0ZpZWxkT2JqZWN0IiwicGtnRmllbGRGaWxlcyIsIk9iamVjdCIsInZhbHVlcyIsImNoZWNrUGtnRmllbGQiLCJiaW4iLCJicm93c2VyIiwibWFpbiIsIm1vZHVsZSIsIm1ldGEiLCJkb2NzIiwiY2F0ZWdvcnkiLCJkZXNjcmlwdGlvbiIsInVybCIsInNjaGVtYSIsInByb3BlcnRpZXMiLCJ1bmlxdWVJdGVtcyIsIml0ZW1zIiwibWluTGVuZ3RoIiwibWlzc2luZ0V4cG9ydHMiLCJ1bnVzZWRFeHBvcnRzIiwiaWdub3JlVW51c2VkVHlwZUV4cG9ydHMiLCJhbnlPZiIsIm1pbkl0ZW1zIiwicmVxdWlyZWQiLCJjcmVhdGUiLCJvcHRpb25zIiwiY2hlY2tFeHBvcnRQcmVzZW5jZSIsIm5vZGUiLCJleHBvcnRDb3VudCIsIm5hbWVzcGFjZUltcG9ydHMiLCJzaXplIiwicmVwb3J0IiwiYm9keSIsImNoZWNrVXNhZ2UiLCJleHBvcnRlZFZhbHVlIiwiaXNUeXBlRXhwb3J0IiwiY29uc29sZSIsImVycm9yIiwiZXhwb3J0c0tleSIsInVwZGF0ZUV4cG9ydFVzYWdlIiwibmV3RXhwb3J0cyIsIm5ld0V4cG9ydElkZW50aWZpZXJzIiwiZXhwb3J0ZWQiLCJ1cGRhdGVJbXBvcnRVc2FnZSIsIm9sZEltcG9ydFBhdGhzIiwib2xkTmFtZXNwYWNlSW1wb3J0cyIsIm5ld05hbWVzcGFjZUltcG9ydHMiLCJvbGRFeHBvcnRBbGwiLCJuZXdFeHBvcnRBbGwiLCJvbGREZWZhdWx0SW1wb3J0cyIsIm5ld0RlZmF1bHRJbXBvcnRzIiwib2xkSW1wb3J0cyIsIm5ld0ltcG9ydHMiLCJwcm9jZXNzRHluYW1pY0ltcG9ydCIsInNvdXJjZSIsInAiLCJJbXBvcnRFeHByZXNzaW9uIiwiY2hpbGQiLCJDYWxsRXhwcmVzc2lvbiIsImNhbGxlZSIsImFyZ3VtZW50cyIsImFzdE5vZGUiLCJyZXNvbHZlZFBhdGgiLCJyYXciLCJyZXBsYWNlIiwiaW1wb3J0ZWQiLCJFeHBvcnREZWZhdWx0RGVjbGFyYXRpb24iLCJFeHBvcnROYW1lZERlY2xhcmF0aW9uIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFNQTtBQUNBO0FBQ0Esc0Q7QUFDQSxrRDtBQUNBO0FBQ0EsMkQ7O0FBRUEsK0M7QUFDQSw2RDtBQUNBLHFDLDJVQWZBOzs7O29YQWlCQTs7Ozs7dVhBTUEsU0FBU0EscUJBQVQsR0FBaUMsQ0FDL0IsSUFBSUMsdUJBQUo7O0FBRUE7QUFDQSxNQUFJO0FBQ29CQyxZQUFRLDZCQUFSLENBRHBCLENBQ0NELGNBREQsWUFDQ0EsY0FERDtBQUVILEdBRkQsQ0FFRSxPQUFPRSxDQUFQLEVBQVU7QUFDVjtBQUNBLFFBQUlBLEVBQUVDLElBQUYsS0FBVyxrQkFBZixFQUFtQztBQUNqQyxZQUFNRCxDQUFOO0FBQ0Q7O0FBRUQ7QUFDQSxRQUFJO0FBQ29CRCxjQUFRLHVDQUFSLENBRHBCLENBQ0NELGNBREQsYUFDQ0EsY0FERDtBQUVILEtBRkQsQ0FFRSxPQUFPRSxDQUFQLEVBQVU7QUFDVjtBQUNBLFVBQUlBLEVBQUVDLElBQUYsS0FBVyxrQkFBZixFQUFtQztBQUNqQyxjQUFNRCxDQUFOO0FBQ0Q7QUFDRjtBQUNGO0FBQ0QsU0FBT0YsY0FBUDtBQUNEOztBQUVEOzs7Ozs7O0FBT0EsU0FBU0ksNEJBQVQsQ0FBc0NKLGNBQXRDLEVBQXNESyxHQUF0RCxFQUEyREMsVUFBM0QsRUFBdUU7QUFDckU7QUFDQTtBQUZxRTtBQUk3REMsd0JBSjZELEdBSWxDQyxRQUFRQyxHQUowQixDQUk3REYsc0JBSjZEOztBQU1yRTtBQUNBLE1BQUlHLG9CQUFvQkgsMEJBQTBCQyxRQUFRQyxHQUFSLENBQVlGLHNCQUFaLEtBQXVDLE9BQXpGOztBQUVBO0FBQ0E7QUFDQSxNQUFJO0FBQzhCTixZQUFRLDZCQUFSLENBRDlC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QyxJQVRsQixFQVN3QjtBQUMzQkEsaUJBQUtwQyxVQUFMLENBQWdCbkUsT0FBaEIsQ0FBd0IsVUFBQ2dELFNBQUQsRUFBZTtBQUNyQzZELHlCQUFXN0QsU0FBWCxFQUFzQkEsVUFBVXNFLFFBQVYsQ0FBbUJ4SCxJQUFuQixJQUEyQmtELFVBQVVzRSxRQUFWLENBQW1CL0UsS0FBcEUsRUFBMkUsS0FBM0U7QUFDRCxhQUZEO0FBR0EvQyx5Q0FBNkIrRyxLQUFLOUcsV0FBbEMsRUFBK0MsVUFBQ0ssSUFBRCxFQUFPaUgsWUFBUCxFQUF3QjtBQUNyRUYseUJBQVdOLElBQVgsRUFBaUJ6RyxJQUFqQixFQUF1QmlILFlBQXZCO0FBQ0QsYUFGRDtBQUdELFdBaEJJLG1DQUFQOztBQWtCRCxLQXBpQmMsbUJBQWpCIiwiZmlsZSI6Im5vLXVudXNlZC1tb2R1bGVzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAZmlsZU92ZXJ2aWV3IEVuc3VyZXMgdGhhdCBtb2R1bGVzIGNvbnRhaW4gZXhwb3J0cyBhbmQvb3IgYWxsXG4gKiBtb2R1bGVzIGFyZSBjb25zdW1lZCB3aXRoaW4gb3RoZXIgbW9kdWxlcy5cbiAqIEBhdXRob3IgUmVuw6kgRmVybWFublxuICovXG5cbmltcG9ydCB7IGdldFBoeXNpY2FsRmlsZW5hbWUgfSBmcm9tICdlc2xpbnQtbW9kdWxlLXV0aWxzL2NvbnRleHRDb21wYXQnO1xuaW1wb3J0IHsgZ2V0RmlsZUV4dGVuc2lvbnMgfSBmcm9tICdlc2xpbnQtbW9kdWxlLXV0aWxzL2lnbm9yZSc7XG5pbXBvcnQgcmVzb2x2ZSBmcm9tICdlc2xpbnQtbW9kdWxlLXV0aWxzL3Jlc29sdmUnO1xuaW1wb3J0IHZpc2l0IGZyb20gJ2VzbGludC1tb2R1bGUtdXRpbHMvdmlzaXQnO1xuaW1wb3J0IHsgZGlybmFtZSwgam9pbiB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHJlYWRQa2dVcCBmcm9tICdlc2xpbnQtbW9kdWxlLXV0aWxzL3JlYWRQa2dVcCc7XG5cbmltcG9ydCBFeHBvcnRNYXBCdWlsZGVyIGZyb20gJy4uL2V4cG9ydE1hcC9idWlsZGVyJztcbmltcG9ydCByZWN1cnNpdmVQYXR0ZXJuQ2FwdHVyZSBmcm9tICcuLi9leHBvcnRNYXAvcGF0dGVybkNhcHR1cmUnO1xuaW1wb3J0IGRvY3NVcmwgZnJvbSAnLi4vZG9jc1VybCc7XG5cbi8qKlxuICogQXR0ZW1wdCB0byBsb2FkIHRoZSBpbnRlcm5hbCBgRmlsZUVudW1lcmF0b3JgIGNsYXNzLCB3aGljaCBoYXMgZXhpc3RlZCBpbiBhIGNvdXBsZVxuICogb2YgZGlmZmVyZW50IHBsYWNlcywgZGVwZW5kaW5nIG9uIHRoZSB2ZXJzaW9uIG9mIGBlc2xpbnRgLiAgVHJ5IHJlcXVpcmluZyBpdCBmcm9tIGJvdGhcbiAqIGxvY2F0aW9ucy5cbiAqIEByZXR1cm5zIFJldHVybnMgdGhlIGBGaWxlRW51bWVyYXRvcmAgY2xhc3MgaWYgaXRzIHJlcXVpcmFibGUsIG90aGVyd2lzZSBgdW5kZWZpbmVkYC5cbiAqL1xuZnVuY3Rpb24gcmVxdWlyZUZpbGVFbnVtZXJhdG9yKCkge1xuICBsZXQgRmlsZUVudW1lcmF0b3I7XG5cbiAgLy8gVHJ5IGdldHRpbmcgaXQgZnJvbSB0aGUgZXNsaW50IHByaXZhdGUgLyBkZXByZWNhdGVkIGFwaVxuICB0cnkge1xuICAgICh7IEZpbGVFbnVtZXJhdG9yIH0gPSByZXF1aXJlKCdlc2xpbnQvdXNlLWF0LXlvdXItb3duLXJpc2snKSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICAvLyBBYnNvcmIgdGhpcyBpZiBpdCdzIE1PRFVMRV9OT1RfRk9VTkRcbiAgICBpZiAoZS5jb2RlICE9PSAnTU9EVUxFX05PVF9GT1VORCcpIHtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuXG4gICAgLy8gSWYgbm90IHRoZXJlLCB0aGVuIHRyeSBnZXR0aW5nIGl0IGZyb20gZXNsaW50L2xpYi9jbGktZW5naW5lL2ZpbGUtZW51bWVyYXRvciAobW92ZWQgdGhlcmUgaW4gdjYpXG4gICAgdHJ5IHtcbiAgICAgICh7IEZpbGVFbnVtZXJhdG9yIH0gPSByZXF1aXJlKCdlc2xpbnQvbGliL2NsaS1lbmdpbmUvZmlsZS1lbnVtZXJhdG9yJykpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIEFic29yYiB0aGlzIGlmIGl0J3MgTU9EVUxFX05PVF9GT1VORFxuICAgICAgaWYgKGUuY29kZSAhPT0gJ01PRFVMRV9OT1RfRk9VTkQnKSB7XG4gICAgICAgIHRocm93IGU7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBGaWxlRW51bWVyYXRvcjtcbn1cblxuLyoqXG4gKiBHaXZlbiBhIEZpbGVFbnVtZXJhdG9yIGNsYXNzLCBpbnN0YW50aWF0ZSBhbmQgbG9hZCB0aGUgbGlzdCBvZiBmaWxlcy5cbiAqIEBwYXJhbSBGaWxlRW51bWVyYXRvciB0aGUgYEZpbGVFbnVtZXJhdG9yYCBjbGFzcyBmcm9tIGBlc2xpbnRgJ3MgaW50ZXJuYWwgYXBpXG4gKiBAcGFyYW0ge3N0cmluZ30gc3JjIHBhdGggdG8gdGhlIHNyYyByb290XG4gKiBAcGFyYW0ge3N0cmluZ1tdfSBleHRlbnNpb25zIGxpc3Qgb2Ygc3VwcG9ydGVkIGV4dGVuc2lvbnNcbiAqIEByZXR1cm5zIHt7IGZpbGVuYW1lOiBzdHJpbmcsIGlnbm9yZWQ6IGJvb2xlYW4gfVtdfSBsaXN0IG9mIGZpbGVzIHRvIG9wZXJhdGUgb25cbiAqL1xuZnVuY3Rpb24gbGlzdEZpbGVzVXNpbmdGaWxlRW51bWVyYXRvcihGaWxlRW51bWVyYXRvciwgc3JjLCBleHRlbnNpb25zKSB7XG4gIC8vIFdlIG5lZWQgdG8ga25vdyB3aGV0aGVyIHRoaXMgaXMgYmVpbmcgcnVuIHdpdGggZmxhdCBjb25maWcgaW4gb3JkZXIgdG9cbiAgLy8gZGV0ZXJtaW5lIGhvdyB0byByZXBvcnQgZXJyb3JzIGlmIEZpbGVFbnVtZXJhdG9yIHRocm93cyBkdWUgdG8gYSBsYWNrIG9mIGVzbGludHJjLlxuXG4gIGNvbnN0IHsgRVNMSU5UX1VTRV9GTEFUX0NPTkZJRyB9ID0gcHJvY2Vzcy5lbnY7XG5cbiAgLy8gVGhpcyBjb25kaXRpb24gaXMgc3VmZmljaWVudCB0byB0ZXN0IGluIHY4LCBzaW5jZSB0aGUgZW52aXJvbm1lbnQgdmFyaWFibGUgaXMgbmVjZXNzYXJ5IHRvIHR1cm4gb24gZmxhdCBjb25maWdcbiAgbGV0IGlzVXNpbmdGbGF0Q29uZmlnID0gRVNMSU5UX1VTRV9GTEFUX0NPTkZJRyAmJiBwcm9jZXNzLmVudi5FU0xJTlRfVVNFX0ZMQVRfQ09ORklHICE9PSAnZmFsc2UnO1xuXG4gIC8vIEluIHRoZSBjYXNlIG9mIHVzaW5nIHY5LCB3ZSBjYW4gY2hlY2sgdGhlIGBzaG91bGRVc2VGbGF0Q29uZmlnYCBmdW5jdGlvblxuICAvLyBJZiB0aGlzIGZ1bmN0aW9uIGlzIHByZXNlbnQsIHRoZW4gd2UgYXNzdW1lIGl0J3MgdjlcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHNob3VsZFVzZUZsYXRDb25maWcgfSA9IHJlcXVpcmUoJ2VzbGludC91c2UtYXQteW91ci1vd24tcmlzaycpO1xuICAgIGlzVXNpbmdGbGF0Q29uZmlnID0gc2hvdWxkVXNlRmxhdENvbmZpZyAmJiBFU0xJTlRfVVNFX0ZMQVRfQ09ORklHICE9PSAnZmFsc2UnO1xuICB9IGNhdGNoIChfKSB7XG4gICAgLy8gV2UgZG9uJ3Qgd2FudCB0byB0aHJvdyBoZXJlLCBzaW5jZSB3ZSBvbmx5IHdhbnQgdG8gdXBkYXRlIHRoZVxuICAgIC8vIGJvb2xlYW4gaWYgdGhlIGZ1bmN0aW9uIGlzIGF2YWlsYWJsZS5cbiAgfVxuXG4gIGNvbnN0IGVudW1lcmF0b3IgPSBuZXcgRmlsZUVudW1lcmF0b3Ioe1xuICAgIGV4dGVuc2lvbnMsXG4gIH0pO1xuXG4gIHRyeSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20oXG4gICAgICBlbnVtZXJhdG9yLml0ZXJhdGVGaWxlcyhzcmMpLFxuICAgICAgKHsgZmlsZVBhdGgsIGlnbm9yZWQgfSkgPT4gKHsgZmlsZW5hbWU6IGZpbGVQYXRoLCBpZ25vcmVkIH0pLFxuICAgICk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICAvLyBJZiB3ZSdyZSB1c2luZyBmbGF0IGNvbmZpZywgYW5kIEZpbGVFbnVtZXJhdG9yIHRocm93cyBkdWUgdG8gYSBsYWNrIG9mIGVzbGludHJjLFxuICAgIC8vIHRoZW4gd2Ugd2FudCB0byB0aHJvdyBhbiBlcnJvciBzbyB0aGF0IHRoZSB1c2VyIGtub3dzIGFib3V0IHRoaXMgcnVsZSdzIHJlbGlhbmNlIG9uXG4gICAgLy8gdGhlIGxlZ2FjeSBjb25maWcuXG4gICAgaWYgKFxuICAgICAgaXNVc2luZ0ZsYXRDb25maWdcbiAgICAgICYmIGUubWVzc2FnZS5pbmNsdWRlcygnTm8gRVNMaW50IGNvbmZpZ3VyYXRpb24gZm91bmQnKVxuICAgICkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBcbkR1ZSB0byB0aGUgZXhjbHVzaW9uIG9mIGNlcnRhaW4gaW50ZXJuYWwgRVNMaW50IEFQSXMgd2hlbiB1c2luZyBmbGF0IGNvbmZpZyxcbnRoZSBpbXBvcnQvbm8tdW51c2VkLW1vZHVsZXMgcnVsZSByZXF1aXJlcyBhbiAuZXNsaW50cmMgZmlsZSB0byBrbm93IHdoaWNoXG5maWxlcyB0byBpZ25vcmUgKGV2ZW4gd2hlbiB1c2luZyBmbGF0IGNvbmZpZykuXG5UaGUgLmVzbGludHJjIGZpbGUgb25seSBuZWVkcyB0byBjb250YWluIFwiaWdub3JlUGF0dGVybnNcIiwgb3IgY2FuIGJlIGVtcHR5IGlmXG55b3UgZG8gbm90IHdhbnQgdG8gaWdub3JlIGFueSBmaWxlcy5cblxuU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9pbXBvcnQtanMvZXNsaW50LXBsdWdpbi1pbXBvcnQvaXNzdWVzLzMwNzlcbmZvciBhZGRpdGlvbmFsIGNvbnRleHQuXG5gKTtcbiAgICB9XG4gICAgLy8gSWYgdGhpcyBpc24ndCB0aGUgY2FzZSwgdGhlbiB3ZSdsbCBqdXN0IGxldCB0aGUgZXJyb3IgYnViYmxlIHVwXG4gICAgdGhyb3cgZTtcbiAgfVxufVxuXG4vKipcbiAqIEF0dGVtcHQgdG8gcmVxdWlyZSBvbGQgdmVyc2lvbnMgb2YgdGhlIGZpbGUgZW51bWVyYXRpb24gY2FwYWJpbGl0eSBmcm9tIHY2IGBlc2xpbnRgIGFuZCBlYXJsaWVyLCBhbmQgdXNlXG4gKiB0aG9zZSBmdW5jdGlvbnMgdG8gcHJvdmlkZSB0aGUgbGlzdCBvZiBmaWxlcyB0byBvcGVyYXRlIG9uXG4gKiBAcGFyYW0ge3N0cmluZ30gc3JjIHBhdGggdG8gdGhlIHNyYyByb290XG4gKiBAcGFyYW0ge3N0cmluZ1tdfSBleHRlbnNpb25zIGxpc3Qgb2Ygc3VwcG9ydGVkIGV4dGVuc2lvbnNcbiAqIEByZXR1cm5zIHtzdHJpbmdbXX0gbGlzdCBvZiBmaWxlcyB0byBvcGVyYXRlIG9uXG4gKi9cbmZ1bmN0aW9uIGxpc3RGaWxlc1dpdGhMZWdhY3lGdW5jdGlvbnMoc3JjLCBleHRlbnNpb25zKSB7XG4gIHRyeSB7XG4gICAgLy8gZXNsaW50L2xpYi91dGlsL2dsb2ItdXRpbCBoYXMgYmVlbiBtb3ZlZCB0byBlc2xpbnQvbGliL3V0aWwvZ2xvYi11dGlscyB3aXRoIHZlcnNpb24gNS4zXG4gICAgY29uc3QgeyBsaXN0RmlsZXNUb1Byb2Nlc3M6IG9yaWdpbmFsTGlzdEZpbGVzVG9Qcm9jZXNzIH0gPSByZXF1aXJlKCdlc2xpbnQvbGliL3V0aWwvZ2xvYi11dGlscycpO1xuICAgIC8vIFByZXZlbnQgcGFzc2luZyBpbnZhbGlkIG9wdGlvbnMgKGV4dGVuc2lvbnMgYXJyYXkpIHRvIG9sZCB2ZXJzaW9ucyBvZiB0aGUgZnVuY3Rpb24uXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2VzbGludC9lc2xpbnQvYmxvYi92NS4xNi4wL2xpYi91dGlsL2dsb2ItdXRpbHMuanMjTDE3OC1MMjgwXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2VzbGludC9lc2xpbnQvYmxvYi92NS4yLjAvbGliL3V0aWwvZ2xvYi11dGlsLmpzI0wxNzQtTDI2OVxuXG4gICAgcmV0dXJuIG9yaWdpbmFsTGlzdEZpbGVzVG9Qcm9jZXNzKHNyYywge1xuICAgICAgZXh0ZW5zaW9ucyxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIC8vIEFic29yYiB0aGlzIGlmIGl0J3MgTU9EVUxFX05PVF9GT1VORFxuICAgIGlmIChlLmNvZGUgIT09ICdNT0RVTEVfTk9UX0ZPVU5EJykge1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG5cbiAgICAvLyBMYXN0IHBsYWNlIHRvIHRyeSAocHJlIHY1LjMpXG4gICAgY29uc3Qge1xuICAgICAgbGlzdEZpbGVzVG9Qcm9jZXNzOiBvcmlnaW5hbExpc3RGaWxlc1RvUHJvY2VzcyxcbiAgICB9ID0gcmVxdWlyZSgnZXNsaW50L2xpYi91dGlsL2dsb2ItdXRpbCcpO1xuICAgIGNvbnN0IHBhdHRlcm5zID0gc3JjLmNvbmNhdChcbiAgICAgIHNyYy5mbGF0TWFwKFxuICAgICAgICAocGF0dGVybikgPT4gZXh0ZW5zaW9ucy5tYXAoKGV4dGVuc2lvbikgPT4gKC9cXCpcXCp8XFwqXFwuLykudGVzdChwYXR0ZXJuKSA/IHBhdHRlcm4gOiBgJHtwYXR0ZXJufS8qKi8qJHtleHRlbnNpb259YCksXG4gICAgICApLFxuICAgICk7XG5cbiAgICByZXR1cm4gb3JpZ2luYWxMaXN0RmlsZXNUb1Byb2Nlc3MocGF0dGVybnMpO1xuICB9XG59XG5cbi8qKlxuICogR2l2ZW4gYSBzcmMgcGF0dGVybiBhbmQgbGlzdCBvZiBzdXBwb3J0ZWQgZXh0ZW5zaW9ucywgcmV0dXJuIGEgbGlzdCBvZiBmaWxlcyB0byBwcm9jZXNzXG4gKiB3aXRoIHRoaXMgcnVsZS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBzcmMgLSBmaWxlLCBkaXJlY3RvcnksIG9yIGdsb2IgcGF0dGVybiBvZiBmaWxlcyB0byBhY3Qgb25cbiAqIEBwYXJhbSB7c3RyaW5nW119IGV4dGVuc2lvbnMgLSBsaXN0IG9mIHN1cHBvcnRlZCBmaWxlIGV4dGVuc2lvbnNcbiAqIEByZXR1cm5zIHtzdHJpbmdbXSB8IHsgZmlsZW5hbWU6IHN0cmluZywgaWdub3JlZDogYm9vbGVhbiB9W119IHRoZSBsaXN0IG9mIGZpbGVzIHRoYXQgdGhpcyBydWxlIHdpbGwgZXZhbHVhdGUuXG4gKi9cbmZ1bmN0aW9uIGxpc3RGaWxlc1RvUHJvY2VzcyhzcmMsIGV4dGVuc2lvbnMpIHtcbiAgY29uc3QgRmlsZUVudW1lcmF0b3IgPSByZXF1aXJlRmlsZUVudW1lcmF0b3IoKTtcblxuICAvLyBJZiB3ZSBnb3QgdGhlIEZpbGVFbnVtZXJhdG9yLCB0aGVuIGxldCdzIGdvIHdpdGggdGhhdFxuICBpZiAoRmlsZUVudW1lcmF0b3IpIHtcbiAgICByZXR1cm4gbGlzdEZpbGVzVXNpbmdGaWxlRW51bWVyYXRvcihGaWxlRW51bWVyYXRvciwgc3JjLCBleHRlbnNpb25zKTtcbiAgfVxuICAvLyBJZiBub3QsIHRoZW4gd2UgY2FuIHRyeSBldmVuIG9sZGVyIHZlcnNpb25zIG9mIHRoaXMgY2FwYWJpbGl0eSAobGlzdEZpbGVzVG9Qcm9jZXNzKVxuICByZXR1cm4gbGlzdEZpbGVzV2l0aExlZ2FjeUZ1bmN0aW9ucyhzcmMsIGV4dGVuc2lvbnMpO1xufVxuXG5jb25zdCBFWFBPUlRfREVGQVVMVF9ERUNMQVJBVElPTiA9ICdFeHBvcnREZWZhdWx0RGVjbGFyYXRpb24nO1xuY29uc3QgRVhQT1JUX05BTUVEX0RFQ0xBUkFUSU9OID0gJ0V4cG9ydE5hbWVkRGVjbGFyYXRpb24nO1xuY29uc3QgRVhQT1JUX0FMTF9ERUNMQVJBVElPTiA9ICdFeHBvcnRBbGxEZWNsYXJhdGlvbic7XG5jb25zdCBJTVBPUlRfREVDTEFSQVRJT04gPSAnSW1wb3J0RGVjbGFyYXRpb24nO1xuY29uc3QgSU1QT1JUX05BTUVTUEFDRV9TUEVDSUZJRVIgPSAnSW1wb3J0TmFtZXNwYWNlU3BlY2lmaWVyJztcbmNvbnN0IElNUE9SVF9ERUZBVUxUX1NQRUNJRklFUiA9ICdJbXBvcnREZWZhdWx0U3BlY2lmaWVyJztcbmNvbnN0IFZBUklBQkxFX0RFQ0xBUkFUSU9OID0gJ1ZhcmlhYmxlRGVjbGFyYXRpb24nO1xuY29uc3QgRlVOQ1RJT05fREVDTEFSQVRJT04gPSAnRnVuY3Rpb25EZWNsYXJhdGlvbic7XG5jb25zdCBDTEFTU19ERUNMQVJBVElPTiA9ICdDbGFzc0RlY2xhcmF0aW9uJztcbmNvbnN0IElERU5USUZJRVIgPSAnSWRlbnRpZmllcic7XG5jb25zdCBPQkpFQ1RfUEFUVEVSTiA9ICdPYmplY3RQYXR0ZXJuJztcbmNvbnN0IEFSUkFZX1BBVFRFUk4gPSAnQXJyYXlQYXR0ZXJuJztcbmNvbnN0IFRTX0lOVEVSRkFDRV9ERUNMQVJBVElPTiA9ICdUU0ludGVyZmFjZURlY2xhcmF0aW9uJztcbmNvbnN0IFRTX1RZUEVfQUxJQVNfREVDTEFSQVRJT04gPSAnVFNUeXBlQWxpYXNEZWNsYXJhdGlvbic7XG5jb25zdCBUU19FTlVNX0RFQ0xBUkFUSU9OID0gJ1RTRW51bURlY2xhcmF0aW9uJztcbmNvbnN0IERFRkFVTFQgPSAnZGVmYXVsdCc7XG5cbmZ1bmN0aW9uIGZvckVhY2hEZWNsYXJhdGlvbklkZW50aWZpZXIoZGVjbGFyYXRpb24sIGNiKSB7XG4gIGlmIChkZWNsYXJhdGlvbikge1xuICAgIGNvbnN0IGlzVHlwZURlY2xhcmF0aW9uID0gZGVjbGFyYXRpb24udHlwZSA9PT0gVFNfSU5URVJGQUNFX0RFQ0xBUkFUSU9OXG4gICAgICB8fCBkZWNsYXJhdGlvbi50eXBlID09PSBUU19UWVBFX0FMSUFTX0RFQ0xBUkFUSU9OXG4gICAgICB8fCBkZWNsYXJhdGlvbi50eXBlID09PSBUU19FTlVNX0RFQ0xBUkFUSU9OO1xuXG4gICAgaWYgKFxuICAgICAgZGVjbGFyYXRpb24udHlwZSA9PT0gRlVOQ1RJT05fREVDTEFSQVRJT05cbiAgICAgIHx8IGRlY2xhcmF0aW9uLnR5cGUgPT09IENMQVNTX0RFQ0xBUkFUSU9OXG4gICAgICB8fCBpc1R5cGVEZWNsYXJhdGlvblxuICAgICkge1xuICAgICAgY2IoZGVjbGFyYXRpb24uaWQubmFtZSwgaXNUeXBlRGVjbGFyYXRpb24pO1xuICAgIH0gZWxzZSBpZiAoZGVjbGFyYXRpb24udHlwZSA9PT0gVkFSSUFCTEVfREVDTEFSQVRJT04pIHtcbiAgICAgIGRlY2xhcmF0aW9uLmRlY2xhcmF0aW9ucy5mb3JFYWNoKCh7IGlkIH0pID0+IHtcbiAgICAgICAgaWYgKGlkLnR5cGUgPT09IE9CSkVDVF9QQVRURVJOKSB7XG4gICAgICAgICAgcmVjdXJzaXZlUGF0dGVybkNhcHR1cmUoaWQsIChwYXR0ZXJuKSA9PiB7XG4gICAgICAgICAgICBpZiAocGF0dGVybi50eXBlID09PSBJREVOVElGSUVSKSB7XG4gICAgICAgICAgICAgIGNiKHBhdHRlcm4ubmFtZSwgZmFsc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2UgaWYgKGlkLnR5cGUgPT09IEFSUkFZX1BBVFRFUk4pIHtcbiAgICAgICAgICBpZC5lbGVtZW50cy5mb3JFYWNoKCh7IG5hbWUgfSkgPT4ge1xuICAgICAgICAgICAgY2IobmFtZSwgZmFsc2UpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNiKGlkLm5hbWUsIGZhbHNlKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogTGlzdCBvZiBpbXBvcnRzIHBlciBmaWxlLlxuICpcbiAqIFJlcHJlc2VudGVkIGJ5IGEgdHdvLWxldmVsIE1hcCB0byBhIFNldCBvZiBpZGVudGlmaWVycy4gVGhlIHVwcGVyLWxldmVsIE1hcFxuICoga2V5cyBhcmUgdGhlIHBhdGhzIHRvIHRoZSBtb2R1bGVzIGNvbnRhaW5pbmcgdGhlIGltcG9ydHMsIHdoaWxlIHRoZVxuICogbG93ZXItbGV2ZWwgTWFwIGtleXMgYXJlIHRoZSBwYXRocyB0byB0aGUgZmlsZXMgd2hpY2ggYXJlIGJlaW5nIGltcG9ydGVkXG4gKiBmcm9tLiBMYXN0bHksIHRoZSBTZXQgb2YgaWRlbnRpZmllcnMgY29udGFpbnMgZWl0aGVyIG5hbWVzIGJlaW5nIGltcG9ydGVkXG4gKiBvciBhIHNwZWNpYWwgQVNUIG5vZGUgbmFtZSBsaXN0ZWQgYWJvdmUgKGUuZyBJbXBvcnREZWZhdWx0U3BlY2lmaWVyKS5cbiAqXG4gKiBGb3IgZXhhbXBsZSwgaWYgd2UgaGF2ZSBhIGZpbGUgbmFtZWQgZm9vLmpzIGNvbnRhaW5pbmc6XG4gKlxuICogICBpbXBvcnQgeyBvMiB9IGZyb20gJy4vYmFyLmpzJztcbiAqXG4gKiBUaGVuIHdlIHdpbGwgaGF2ZSBhIHN0cnVjdHVyZSB0aGF0IGxvb2tzIGxpa2U6XG4gKlxuICogICBNYXAgeyAnZm9vLmpzJyA9PiBNYXAgeyAnYmFyLmpzJyA9PiBTZXQgeyAnbzInIH0gfSB9XG4gKlxuICogQHR5cGUge01hcDxzdHJpbmcsIE1hcDxzdHJpbmcsIFNldDxzdHJpbmc+Pj59XG4gKi9cbmNvbnN0IGltcG9ydExpc3QgPSBuZXcgTWFwKCk7XG5cbi8qKlxuICogTGlzdCBvZiBleHBvcnRzIHBlciBmaWxlLlxuICpcbiAqIFJlcHJlc2VudGVkIGJ5IGEgdHdvLWxldmVsIE1hcCB0byBhbiBvYmplY3Qgb2YgbWV0YWRhdGEuIFRoZSB1cHBlci1sZXZlbCBNYXBcbiAqIGtleXMgYXJlIHRoZSBwYXRocyB0byB0aGUgbW9kdWxlcyBjb250YWluaW5nIHRoZSBleHBvcnRzLCB3aGlsZSB0aGVcbiAqIGxvd2VyLWxldmVsIE1hcCBrZXlzIGFyZSB0aGUgc3BlY2lmaWMgaWRlbnRpZmllcnMgb3Igc3BlY2lhbCBBU1Qgbm9kZSBuYW1lc1xuICogYmVpbmcgZXhwb3J0ZWQuIFRoZSBsZWFmLWxldmVsIG1ldGFkYXRhIG9iamVjdCBhdCB0aGUgbW9tZW50IG9ubHkgY29udGFpbnMgYVxuICogYHdoZXJlVXNlZGAgcHJvcGVydHksIHdoaWNoIGNvbnRhaW5zIGEgU2V0IG9mIHBhdGhzIHRvIG1vZHVsZXMgdGhhdCBpbXBvcnRcbiAqIHRoZSBuYW1lLlxuICpcbiAqIEZvciBleGFtcGxlLCBpZiB3ZSBoYXZlIGEgZmlsZSBuYW1lZCBiYXIuanMgY29udGFpbmluZyB0aGUgZm9sbG93aW5nIGV4cG9ydHM6XG4gKlxuICogICBjb25zdCBvMiA9ICdiYXInO1xuICogICBleHBvcnQgeyBvMiB9O1xuICpcbiAqIEFuZCBhIGZpbGUgbmFtZWQgZm9vLmpzIGNvbnRhaW5pbmcgdGhlIGZvbGxvd2luZyBpbXBvcnQ6XG4gKlxuICogICBpbXBvcnQgeyBvMiB9IGZyb20gJy4vYmFyLmpzJztcbiAqXG4gKiBUaGVuIHdlIHdpbGwgaGF2ZSBhIHN0cnVjdHVyZSB0aGF0IGxvb2tzIGxpa2U6XG4gKlxuICogICBNYXAgeyAnYmFyLmpzJyA9PiBNYXAgeyAnbzInID0+IHsgd2hlcmVVc2VkOiBTZXQgeyAnZm9vLmpzJyB9IH0gfSB9XG4gKlxuICogQHR5cGUge01hcDxzdHJpbmcsIE1hcDxzdHJpbmcsIG9iamVjdD4+fVxuICovXG5jb25zdCBleHBvcnRMaXN0ID0gbmV3IE1hcCgpO1xuXG5jb25zdCB2aXNpdG9yS2V5TWFwID0gbmV3IE1hcCgpO1xuXG4vKiogQHR5cGUge1NldDxzdHJpbmc+fSAqL1xuY29uc3QgaWdub3JlZEZpbGVzID0gbmV3IFNldCgpO1xuY29uc3QgZmlsZXNPdXRzaWRlU3JjID0gbmV3IFNldCgpO1xuXG5jb25zdCBpc05vZGVNb2R1bGUgPSAocGF0aCkgPT4gKC9cXC8obm9kZV9tb2R1bGVzKVxcLy8pLnRlc3QocGF0aCk7XG5cbi8qKlxuICogcmVhZCBhbGwgZmlsZXMgbWF0Y2hpbmcgdGhlIHBhdHRlcm5zIGluIHNyYyBhbmQgaWdub3JlRXhwb3J0c1xuICpcbiAqIHJldHVybiBhbGwgZmlsZXMgbWF0Y2hpbmcgc3JjIHBhdHRlcm4sIHdoaWNoIGFyZSBub3QgbWF0Y2hpbmcgdGhlIGlnbm9yZUV4cG9ydHMgcGF0dGVyblxuICogQHR5cGUgeyhzcmM6IHN0cmluZywgaWdub3JlRXhwb3J0czogc3RyaW5nLCBjb250ZXh0OiBpbXBvcnQoJ2VzbGludCcpLlJ1bGUuUnVsZUNvbnRleHQpID0+IFNldDxzdHJpbmc+fVxuICovXG5mdW5jdGlvbiByZXNvbHZlRmlsZXMoc3JjLCBpZ25vcmVFeHBvcnRzLCBjb250ZXh0KSB7XG4gIGNvbnN0IGV4dGVuc2lvbnMgPSBBcnJheS5mcm9tKGdldEZpbGVFeHRlbnNpb25zKGNvbnRleHQuc2V0dGluZ3MpKTtcblxuICBjb25zdCBzcmNGaWxlTGlzdCA9IGxpc3RGaWxlc1RvUHJvY2VzcyhzcmMsIGV4dGVuc2lvbnMpO1xuXG4gIC8vIHByZXBhcmUgbGlzdCBvZiBpZ25vcmVkIGZpbGVzXG4gIGNvbnN0IGlnbm9yZWRGaWxlc0xpc3QgPSBsaXN0RmlsZXNUb1Byb2Nlc3MoaWdub3JlRXhwb3J0cywgZXh0ZW5zaW9ucyk7XG5cbiAgLy8gVGhlIG1vZGVybiBhcGkgd2lsbCByZXR1cm4gYSBsaXN0IG9mIGZpbGUgcGF0aHMsIHJhdGhlciB0aGFuIGFuIG9iamVjdFxuICBpZiAoaWdub3JlZEZpbGVzTGlzdC5sZW5ndGggJiYgdHlwZW9mIGlnbm9yZWRGaWxlc0xpc3RbMF0gPT09ICdzdHJpbmcnKSB7XG4gICAgaWdub3JlZEZpbGVzTGlzdC5mb3JFYWNoKChmaWxlbmFtZSkgPT4gaWdub3JlZEZpbGVzLmFkZChmaWxlbmFtZSkpO1xuICB9IGVsc2Uge1xuICAgIGlnbm9yZWRGaWxlc0xpc3QuZm9yRWFjaCgoeyBmaWxlbmFtZSB9KSA9PiBpZ25vcmVkRmlsZXMuYWRkKGZpbGVuYW1lKSk7XG4gIH1cblxuICAvLyBwcmVwYXJlIGxpc3Qgb2Ygc291cmNlIGZpbGVzLCBkb24ndCBjb25zaWRlciBmaWxlcyBmcm9tIG5vZGVfbW9kdWxlc1xuICBjb25zdCByZXNvbHZlZEZpbGVzID0gc3JjRmlsZUxpc3QubGVuZ3RoICYmIHR5cGVvZiBzcmNGaWxlTGlzdFswXSA9PT0gJ3N0cmluZydcbiAgICA/IHNyY0ZpbGVMaXN0LmZpbHRlcigoZmlsZVBhdGgpID0+ICFpc05vZGVNb2R1bGUoZmlsZVBhdGgpKVxuICAgIDogc3JjRmlsZUxpc3QuZmxhdE1hcCgoeyBmaWxlbmFtZSB9KSA9PiBpc05vZGVNb2R1bGUoZmlsZW5hbWUpID8gW10gOiBmaWxlbmFtZSk7XG5cbiAgcmV0dXJuIG5ldyBTZXQocmVzb2x2ZWRGaWxlcyk7XG59XG5cbi8qKlxuICogcGFyc2UgYWxsIHNvdXJjZSBmaWxlcyBhbmQgYnVpbGQgdXAgMiBtYXBzIGNvbnRhaW5pbmcgdGhlIGV4aXN0aW5nIGltcG9ydHMgYW5kIGV4cG9ydHNcbiAqL1xuY29uc3QgcHJlcGFyZUltcG9ydHNBbmRFeHBvcnRzID0gKHNyY0ZpbGVzLCBjb250ZXh0KSA9PiB7XG4gIGNvbnN0IGV4cG9ydEFsbCA9IG5ldyBNYXAoKTtcbiAgc3JjRmlsZXMuZm9yRWFjaCgoZmlsZSkgPT4ge1xuICAgIGNvbnN0IGV4cG9ydHMgPSBuZXcgTWFwKCk7XG4gICAgY29uc3QgaW1wb3J0cyA9IG5ldyBNYXAoKTtcbiAgICBjb25zdCBjdXJyZW50RXhwb3J0cyA9IEV4cG9ydE1hcEJ1aWxkZXIuZ2V0KGZpbGUsIGNvbnRleHQpO1xuICAgIGlmIChjdXJyZW50RXhwb3J0cykge1xuICAgICAgY29uc3Qge1xuICAgICAgICBkZXBlbmRlbmNpZXMsXG4gICAgICAgIHJlZXhwb3J0cyxcbiAgICAgICAgaW1wb3J0czogbG9jYWxJbXBvcnRMaXN0LFxuICAgICAgICBuYW1lc3BhY2UsXG4gICAgICAgIHZpc2l0b3JLZXlzLFxuICAgICAgfSA9IGN1cnJlbnRFeHBvcnRzO1xuXG4gICAgICB2aXNpdG9yS2V5TWFwLnNldChmaWxlLCB2aXNpdG9yS2V5cyk7XG4gICAgICAvLyBkZXBlbmRlbmNpZXMgPT09IGV4cG9ydCAqIGZyb21cbiAgICAgIGNvbnN0IGN1cnJlbnRFeHBvcnRBbGwgPSBuZXcgU2V0KCk7XG4gICAgICBkZXBlbmRlbmNpZXMuZm9yRWFjaCgoZ2V0RGVwZW5kZW5jeSkgPT4ge1xuICAgICAgICBjb25zdCBkZXBlbmRlbmN5ID0gZ2V0RGVwZW5kZW5jeSgpO1xuICAgICAgICBpZiAoZGVwZW5kZW5jeSA9PT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGN1cnJlbnRFeHBvcnRBbGwuYWRkKGRlcGVuZGVuY3kucGF0aCk7XG4gICAgICB9KTtcbiAgICAgIGV4cG9ydEFsbC5zZXQoZmlsZSwgY3VycmVudEV4cG9ydEFsbCk7XG5cbiAgICAgIHJlZXhwb3J0cy5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiB7XG4gICAgICAgIGlmIChrZXkgPT09IERFRkFVTFQpIHtcbiAgICAgICAgICBleHBvcnRzLnNldChJTVBPUlRfREVGQVVMVF9TUEVDSUZJRVIsIHsgd2hlcmVVc2VkOiBuZXcgU2V0KCkgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZXhwb3J0cy5zZXQoa2V5LCB7IHdoZXJlVXNlZDogbmV3IFNldCgpIH0pO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlZXhwb3J0ID0gdmFsdWUuZ2V0SW1wb3J0KCk7XG4gICAgICAgIGlmICghcmVleHBvcnQpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGxvY2FsSW1wb3J0ID0gaW1wb3J0cy5nZXQocmVleHBvcnQucGF0aCk7XG4gICAgICAgIGxldCBjdXJyZW50VmFsdWU7XG4gICAgICAgIGlmICh2YWx1ZS5sb2NhbCA9PT0gREVGQVVMVCkge1xuICAgICAgICAgIGN1cnJlbnRWYWx1ZSA9IElNUE9SVF9ERUZBVUxUX1NQRUNJRklFUjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjdXJyZW50VmFsdWUgPSB2YWx1ZS5sb2NhbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIGxvY2FsSW1wb3J0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIGxvY2FsSW1wb3J0ID0gbmV3IFNldChbLi4ubG9jYWxJbXBvcnQsIGN1cnJlbnRWYWx1ZV0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxvY2FsSW1wb3J0ID0gbmV3IFNldChbY3VycmVudFZhbHVlXSk7XG4gICAgICAgIH1cbiAgICAgICAgaW1wb3J0cy5zZXQocmVleHBvcnQucGF0aCwgbG9jYWxJbXBvcnQpO1xuICAgICAgfSk7XG5cbiAgICAgIGxvY2FsSW1wb3J0TGlzdC5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiB7XG4gICAgICAgIGlmIChpc05vZGVNb2R1bGUoa2V5KSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBsb2NhbEltcG9ydCA9IGltcG9ydHMuZ2V0KGtleSkgfHwgbmV3IFNldCgpO1xuICAgICAgICB2YWx1ZS5kZWNsYXJhdGlvbnMuZm9yRWFjaCgoeyBpbXBvcnRlZFNwZWNpZmllcnMgfSkgPT4ge1xuICAgICAgICAgIGltcG9ydGVkU3BlY2lmaWVycy5mb3JFYWNoKChzcGVjaWZpZXIpID0+IHtcbiAgICAgICAgICAgIGxvY2FsSW1wb3J0LmFkZChzcGVjaWZpZXIpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgICAgaW1wb3J0cy5zZXQoa2V5LCBsb2NhbEltcG9ydCk7XG4gICAgICB9KTtcbiAgICAgIGltcG9ydExpc3Quc2V0KGZpbGUsIGltcG9ydHMpO1xuXG4gICAgICAvLyBidWlsZCB1cCBleHBvcnQgbGlzdCBvbmx5LCBpZiBmaWxlIGlzIG5vdCBpZ25vcmVkXG4gICAgICBpZiAoaWdub3JlZEZpbGVzLmhhcyhmaWxlKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBuYW1lc3BhY2UuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuICAgICAgICBpZiAoa2V5ID09PSBERUZBVUxUKSB7XG4gICAgICAgICAgZXhwb3J0cy5zZXQoSU1QT1JUX0RFRkFVTFRfU1BFQ0lGSUVSLCB7IHdoZXJlVXNlZDogbmV3IFNldCgpIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGV4cG9ydHMuc2V0KGtleSwgeyB3aGVyZVVzZWQ6IG5ldyBTZXQoKSB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIGV4cG9ydHMuc2V0KEVYUE9SVF9BTExfREVDTEFSQVRJT04sIHsgd2hlcmVVc2VkOiBuZXcgU2V0KCkgfSk7XG4gICAgZXhwb3J0cy5zZXQoSU1QT1JUX05BTUVTUEFDRV9TUEVDSUZJRVIsIHsgd2hlcmVVc2VkOiBuZXcgU2V0KCkgfSk7XG4gICAgZXhwb3J0TGlzdC5zZXQoZmlsZSwgZXhwb3J0cyk7XG4gIH0pO1xuICBleHBvcnRBbGwuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuICAgIHZhbHVlLmZvckVhY2goKHZhbCkgPT4ge1xuICAgICAgY29uc3QgY3VycmVudEV4cG9ydHMgPSBleHBvcnRMaXN0LmdldCh2YWwpO1xuICAgICAgaWYgKGN1cnJlbnRFeHBvcnRzKSB7XG4gICAgICAgIGNvbnN0IGN1cnJlbnRFeHBvcnQgPSBjdXJyZW50RXhwb3J0cy5nZXQoRVhQT1JUX0FMTF9ERUNMQVJBVElPTik7XG4gICAgICAgIGN1cnJlbnRFeHBvcnQud2hlcmVVc2VkLmFkZChrZXkpO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcbn07XG5cbi8qKlxuICogdHJhdmVyc2UgdGhyb3VnaCBhbGwgaW1wb3J0cyBhbmQgYWRkIHRoZSByZXNwZWN0aXZlIHBhdGggdG8gdGhlIHdoZXJlVXNlZC1saXN0XG4gKiBvZiB0aGUgY29ycmVzcG9uZGluZyBleHBvcnRcbiAqL1xuY29uc3QgZGV0ZXJtaW5lVXNhZ2UgPSAoKSA9PiB7XG4gIGltcG9ydExpc3QuZm9yRWFjaCgobGlzdFZhbHVlLCBsaXN0S2V5KSA9PiB7XG4gICAgbGlzdFZhbHVlLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgIGNvbnN0IGV4cG9ydHMgPSBleHBvcnRMaXN0LmdldChrZXkpO1xuICAgICAgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICB2YWx1ZS5mb3JFYWNoKChjdXJyZW50SW1wb3J0KSA9PiB7XG4gICAgICAgICAgbGV0IHNwZWNpZmllcjtcbiAgICAgICAgICBpZiAoY3VycmVudEltcG9ydCA9PT0gSU1QT1JUX05BTUVTUEFDRV9TUEVDSUZJRVIpIHtcbiAgICAgICAgICAgIHNwZWNpZmllciA9IElNUE9SVF9OQU1FU1BBQ0VfU1BFQ0lGSUVSO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY3VycmVudEltcG9ydCA9PT0gSU1QT1JUX0RFRkFVTFRfU1BFQ0lGSUVSKSB7XG4gICAgICAgICAgICBzcGVjaWZpZXIgPSBJTVBPUlRfREVGQVVMVF9TUEVDSUZJRVI7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNwZWNpZmllciA9IGN1cnJlbnRJbXBvcnQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh0eXBlb2Ygc3BlY2lmaWVyICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgY29uc3QgZXhwb3J0U3RhdGVtZW50ID0gZXhwb3J0cy5nZXQoc3BlY2lmaWVyKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZXhwb3J0U3RhdGVtZW50ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICBjb25zdCB7IHdoZXJlVXNlZCB9ID0gZXhwb3J0U3RhdGVtZW50O1xuICAgICAgICAgICAgICB3aGVyZVVzZWQuYWRkKGxpc3RLZXkpO1xuICAgICAgICAgICAgICBleHBvcnRzLnNldChzcGVjaWZpZXIsIHsgd2hlcmVVc2VkIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pO1xufTtcblxuY29uc3QgZ2V0U3JjID0gKHNyYykgPT4ge1xuICBpZiAoc3JjKSB7XG4gICAgcmV0dXJuIHNyYztcbiAgfVxuICByZXR1cm4gW3Byb2Nlc3MuY3dkKCldO1xufTtcblxuLyoqXG4gKiBwcmVwYXJlIHRoZSBsaXN0cyBvZiBleGlzdGluZyBpbXBvcnRzIGFuZCBleHBvcnRzIC0gc2hvdWxkIG9ubHkgYmUgZXhlY3V0ZWQgb25jZSBhdFxuICogdGhlIHN0YXJ0IG9mIGEgbmV3IGVzbGludCBydW5cbiAqL1xuLyoqIEB0eXBlIHtTZXQ8c3RyaW5nPn0gKi9cbmxldCBzcmNGaWxlcztcbmxldCBsYXN0UHJlcGFyZUtleTtcbmNvbnN0IGRvUHJlcGFyYXRpb24gPSAoc3JjLCBpZ25vcmVFeHBvcnRzLCBjb250ZXh0KSA9PiB7XG4gIGNvbnN0IHByZXBhcmVLZXkgPSBKU09OLnN0cmluZ2lmeSh7XG4gICAgc3JjOiAoc3JjIHx8IFtdKS5zb3J0KCksXG4gICAgaWdub3JlRXhwb3J0czogKGlnbm9yZUV4cG9ydHMgfHwgW10pLnNvcnQoKSxcbiAgICBleHRlbnNpb25zOiBBcnJheS5mcm9tKGdldEZpbGVFeHRlbnNpb25zKGNvbnRleHQuc2V0dGluZ3MpKS5zb3J0KCksXG4gIH0pO1xuICBpZiAocHJlcGFyZUtleSA9PT0gbGFzdFByZXBhcmVLZXkpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBpbXBvcnRMaXN0LmNsZWFyKCk7XG4gIGV4cG9ydExpc3QuY2xlYXIoKTtcbiAgaWdub3JlZEZpbGVzLmNsZWFyKCk7XG4gIGZpbGVzT3V0c2lkZVNyYy5jbGVhcigpO1xuXG4gIHNyY0ZpbGVzID0gcmVzb2x2ZUZpbGVzKGdldFNyYyhzcmMpLCBpZ25vcmVFeHBvcnRzLCBjb250ZXh0KTtcbiAgcHJlcGFyZUltcG9ydHNBbmRFeHBvcnRzKHNyY0ZpbGVzLCBjb250ZXh0KTtcbiAgZGV0ZXJtaW5lVXNhZ2UoKTtcbiAgbGFzdFByZXBhcmVLZXkgPSBwcmVwYXJlS2V5O1xufTtcblxuY29uc3QgbmV3TmFtZXNwYWNlSW1wb3J0RXhpc3RzID0gKHNwZWNpZmllcnMpID0+IHNwZWNpZmllcnMuc29tZSgoeyB0eXBlIH0pID0+IHR5cGUgPT09IElNUE9SVF9OQU1FU1BBQ0VfU1BFQ0lGSUVSKTtcblxuY29uc3QgbmV3RGVmYXVsdEltcG9ydEV4aXN0cyA9IChzcGVjaWZpZXJzKSA9PiBzcGVjaWZpZXJzLnNvbWUoKHsgdHlwZSB9KSA9PiB0eXBlID09PSBJTVBPUlRfREVGQVVMVF9TUEVDSUZJRVIpO1xuXG5jb25zdCBmaWxlSXNJblBrZyA9IChmaWxlKSA9PiB7XG4gIGNvbnN0IHsgcGF0aCwgcGtnIH0gPSByZWFkUGtnVXAoeyBjd2Q6IGZpbGUgfSk7XG4gIGNvbnN0IGJhc2VQYXRoID0gZGlybmFtZShwYXRoKTtcblxuICBjb25zdCBjaGVja1BrZ0ZpZWxkU3RyaW5nID0gKHBrZ0ZpZWxkKSA9PiB7XG4gICAgaWYgKGpvaW4oYmFzZVBhdGgsIHBrZ0ZpZWxkKSA9PT0gZmlsZSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGNoZWNrUGtnRmllbGRPYmplY3QgPSAocGtnRmllbGQpID0+IHtcbiAgICBjb25zdCBwa2dGaWVsZEZpbGVzID0gT2JqZWN0LnZhbHVlcyhwa2dGaWVsZCkuZmxhdE1hcCgodmFsdWUpID0+IHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nID8gW10gOiBqb2luKGJhc2VQYXRoLCB2YWx1ZSkpO1xuXG4gICAgaWYgKHBrZ0ZpZWxkRmlsZXMuaW5jbHVkZXMoZmlsZSkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBjaGVja1BrZ0ZpZWxkID0gKHBrZ0ZpZWxkKSA9PiB7XG4gICAgaWYgKHR5cGVvZiBwa2dGaWVsZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiBjaGVja1BrZ0ZpZWxkU3RyaW5nKHBrZ0ZpZWxkKTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHBrZ0ZpZWxkID09PSAnb2JqZWN0Jykge1xuICAgICAgcmV0dXJuIGNoZWNrUGtnRmllbGRPYmplY3QocGtnRmllbGQpO1xuICAgIH1cbiAgfTtcblxuICBpZiAocGtnLnByaXZhdGUgPT09IHRydWUpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAocGtnLmJpbikge1xuICAgIGlmIChjaGVja1BrZ0ZpZWxkKHBrZy5iaW4pKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBpZiAocGtnLmJyb3dzZXIpIHtcbiAgICBpZiAoY2hlY2tQa2dGaWVsZChwa2cuYnJvd3NlcikpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIGlmIChwa2cubWFpbikge1xuICAgIGlmIChjaGVja1BrZ0ZpZWxkU3RyaW5nKHBrZy5tYWluKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGE6IHtcbiAgICB0eXBlOiAnc3VnZ2VzdGlvbicsXG4gICAgZG9jczoge1xuICAgICAgY2F0ZWdvcnk6ICdIZWxwZnVsIHdhcm5pbmdzJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRm9yYmlkIG1vZHVsZXMgd2l0aG91dCBleHBvcnRzLCBvciBleHBvcnRzIHdpdGhvdXQgbWF0Y2hpbmcgaW1wb3J0IGluIGFub3RoZXIgbW9kdWxlLicsXG4gICAgICB1cmw6IGRvY3NVcmwoJ25vLXVudXNlZC1tb2R1bGVzJyksXG4gICAgfSxcbiAgICBzY2hlbWE6IFt7XG4gICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgIHNyYzoge1xuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnZmlsZXMvcGF0aHMgdG8gYmUgYW5hbHl6ZWQgKG9ubHkgZm9yIHVudXNlZCBleHBvcnRzKScsXG4gICAgICAgICAgdHlwZTogJ2FycmF5JyxcbiAgICAgICAgICB1bmlxdWVJdGVtczogdHJ1ZSxcbiAgICAgICAgICBpdGVtczoge1xuICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICBtaW5MZW5ndGg6IDEsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgaWdub3JlRXhwb3J0czoge1xuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnZmlsZXMvcGF0aHMgZm9yIHdoaWNoIHVudXNlZCBleHBvcnRzIHdpbGwgbm90IGJlIHJlcG9ydGVkIChlLmcgbW9kdWxlIGVudHJ5IHBvaW50cyknLFxuICAgICAgICAgIHR5cGU6ICdhcnJheScsXG4gICAgICAgICAgdW5pcXVlSXRlbXM6IHRydWUsXG4gICAgICAgICAgaXRlbXM6IHtcbiAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgbWluTGVuZ3RoOiAxLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIG1pc3NpbmdFeHBvcnRzOiB7XG4gICAgICAgICAgZGVzY3JpcHRpb246ICdyZXBvcnQgbW9kdWxlcyB3aXRob3V0IGFueSBleHBvcnRzJyxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgIH0sXG4gICAgICAgIHVudXNlZEV4cG9ydHM6IHtcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ3JlcG9ydCBleHBvcnRzIHdpdGhvdXQgYW55IHVzYWdlJyxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgIH0sXG4gICAgICAgIGlnbm9yZVVudXNlZFR5cGVFeHBvcnRzOiB7XG4gICAgICAgICAgZGVzY3JpcHRpb246ICdpZ25vcmUgdHlwZSBleHBvcnRzIHdpdGhvdXQgYW55IHVzYWdlJyxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgYW55T2Y6IFtcbiAgICAgICAge1xuICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIHVudXNlZEV4cG9ydHM6IHsgZW51bTogW3RydWVdIH0sXG4gICAgICAgICAgICBzcmM6IHtcbiAgICAgICAgICAgICAgbWluSXRlbXM6IDEsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcmVxdWlyZWQ6IFsndW51c2VkRXhwb3J0cyddLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgbWlzc2luZ0V4cG9ydHM6IHsgZW51bTogW3RydWVdIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICByZXF1aXJlZDogWydtaXNzaW5nRXhwb3J0cyddLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9XSxcbiAgfSxcblxuICBjcmVhdGUoY29udGV4dCkge1xuICAgIGNvbnN0IHtcbiAgICAgIHNyYyxcbiAgICAgIGlnbm9yZUV4cG9ydHMgPSBbXSxcbiAgICAgIG1pc3NpbmdFeHBvcnRzLFxuICAgICAgdW51c2VkRXhwb3J0cyxcbiAgICAgIGlnbm9yZVVudXNlZFR5cGVFeHBvcnRzLFxuICAgIH0gPSBjb250ZXh0Lm9wdGlvbnNbMF0gfHwge307XG5cbiAgICBpZiAodW51c2VkRXhwb3J0cykge1xuICAgICAgZG9QcmVwYXJhdGlvbihzcmMsIGlnbm9yZUV4cG9ydHMsIGNvbnRleHQpO1xuICAgIH1cblxuICAgIGNvbnN0IGZpbGUgPSBnZXRQaHlzaWNhbEZpbGVuYW1lKGNvbnRleHQpO1xuXG4gICAgY29uc3QgY2hlY2tFeHBvcnRQcmVzZW5jZSA9IChub2RlKSA9PiB7XG4gICAgICBpZiAoIW1pc3NpbmdFeHBvcnRzKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKGlnbm9yZWRGaWxlcy5oYXMoZmlsZSkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBleHBvcnRDb3VudCA9IGV4cG9ydExpc3QuZ2V0KGZpbGUpO1xuICAgICAgY29uc3QgZXhwb3J0QWxsID0gZXhwb3J0Q291bnQuZ2V0KEVYUE9SVF9BTExfREVDTEFSQVRJT04pO1xuICAgICAgY29uc3QgbmFtZXNwYWNlSW1wb3J0cyA9IGV4cG9ydENvdW50LmdldChJTVBPUlRfTkFNRVNQQUNFX1NQRUNJRklFUik7XG5cbiAgICAgIGV4cG9ydENvdW50LmRlbGV0ZShFWFBPUlRfQUxMX0RFQ0xBUkFUSU9OKTtcbiAgICAgIGV4cG9ydENvdW50LmRlbGV0ZShJTVBPUlRfTkFNRVNQQUNFX1NQRUNJRklFUik7XG4gICAgICBpZiAoZXhwb3J0Q291bnQuc2l6ZSA8IDEpIHtcbiAgICAgICAgLy8gbm9kZS5ib2R5WzBdID09PSAndW5kZWZpbmVkJyBvbmx5IGhhcHBlbnMsIGlmIGV2ZXJ5dGhpbmcgaXMgY29tbWVudGVkIG91dCBpbiB0aGUgZmlsZVxuICAgICAgICAvLyBiZWluZyBsaW50ZWRcbiAgICAgICAgY29udGV4dC5yZXBvcnQobm9kZS5ib2R5WzBdID8gbm9kZS5ib2R5WzBdIDogbm9kZSwgJ05vIGV4cG9ydHMgZm91bmQnKTtcbiAgICAgIH1cbiAgICAgIGV4cG9ydENvdW50LnNldChFWFBPUlRfQUxMX0RFQ0xBUkFUSU9OLCBleHBvcnRBbGwpO1xuICAgICAgZXhwb3J0Q291bnQuc2V0KElNUE9SVF9OQU1FU1BBQ0VfU1BFQ0lGSUVSLCBuYW1lc3BhY2VJbXBvcnRzKTtcbiAgICB9O1xuXG4gICAgY29uc3QgY2hlY2tVc2FnZSA9IChub2RlLCBleHBvcnRlZFZhbHVlLCBpc1R5cGVFeHBvcnQpID0+IHtcbiAgICAgIGlmICghdW51c2VkRXhwb3J0cykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChpc1R5cGVFeHBvcnQgJiYgaWdub3JlVW51c2VkVHlwZUV4cG9ydHMpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoaWdub3JlZEZpbGVzLmhhcyhmaWxlKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChmaWxlSXNJblBrZyhmaWxlKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChmaWxlc091dHNpZGVTcmMuaGFzKGZpbGUpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gbWFrZSBzdXJlIGZpbGUgdG8gYmUgbGludGVkIGlzIGluY2x1ZGVkIGluIHNvdXJjZSBmaWxlc1xuICAgICAgaWYgKCFzcmNGaWxlcy5oYXMoZmlsZSkpIHtcbiAgICAgICAgc3JjRmlsZXMgPSByZXNvbHZlRmlsZXMoZ2V0U3JjKHNyYyksIGlnbm9yZUV4cG9ydHMsIGNvbnRleHQpO1xuICAgICAgICBpZiAoIXNyY0ZpbGVzLmhhcyhmaWxlKSkge1xuICAgICAgICAgIGZpbGVzT3V0c2lkZVNyYy5hZGQoZmlsZSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGV4cG9ydHMgPSBleHBvcnRMaXN0LmdldChmaWxlKTtcblxuICAgICAgaWYgKCFleHBvcnRzKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYGZpbGUgXFxgJHtmaWxlfVxcYCBoYXMgbm8gZXhwb3J0cy4gUGxlYXNlIHVwZGF0ZSB0byB0aGUgbGF0ZXN0LCBhbmQgaWYgaXQgc3RpbGwgaGFwcGVucywgcmVwb3J0IHRoaXMgb24gaHR0cHM6Ly9naXRodWIuY29tL2ltcG9ydC1qcy9lc2xpbnQtcGx1Z2luLWltcG9ydC9pc3N1ZXMvMjg2NiFgKTtcbiAgICAgIH1cblxuICAgICAgLy8gc3BlY2lhbCBjYXNlOiBleHBvcnQgKiBmcm9tXG4gICAgICBjb25zdCBleHBvcnRBbGwgPSBleHBvcnRzLmdldChFWFBPUlRfQUxMX0RFQ0xBUkFUSU9OKTtcbiAgICAgIGlmICh0eXBlb2YgZXhwb3J0QWxsICE9PSAndW5kZWZpbmVkJyAmJiBleHBvcnRlZFZhbHVlICE9PSBJTVBPUlRfREVGQVVMVF9TUEVDSUZJRVIpIHtcbiAgICAgICAgaWYgKGV4cG9ydEFsbC53aGVyZVVzZWQuc2l6ZSA+IDApIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gc3BlY2lhbCBjYXNlOiBuYW1lc3BhY2UgaW1wb3J0XG4gICAgICBjb25zdCBuYW1lc3BhY2VJbXBvcnRzID0gZXhwb3J0cy5nZXQoSU1QT1JUX05BTUVTUEFDRV9TUEVDSUZJRVIpO1xuICAgICAgaWYgKHR5cGVvZiBuYW1lc3BhY2VJbXBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBpZiAobmFtZXNwYWNlSW1wb3J0cy53aGVyZVVzZWQuc2l6ZSA+IDApIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gZXhwb3J0c0xpc3Qgd2lsbCBhbHdheXMgbWFwIGFueSBpbXBvcnRlZCB2YWx1ZSBvZiAnZGVmYXVsdCcgdG8gJ0ltcG9ydERlZmF1bHRTcGVjaWZpZXInXG4gICAgICBjb25zdCBleHBvcnRzS2V5ID0gZXhwb3J0ZWRWYWx1ZSA9PT0gREVGQVVMVCA/IElNUE9SVF9ERUZBVUxUX1NQRUNJRklFUiA6IGV4cG9ydGVkVmFsdWU7XG5cbiAgICAgIGNvbnN0IGV4cG9ydFN0YXRlbWVudCA9IGV4cG9ydHMuZ2V0KGV4cG9ydHNLZXkpO1xuXG4gICAgICBjb25zdCB2YWx1ZSA9IGV4cG9ydHNLZXkgPT09IElNUE9SVF9ERUZBVUxUX1NQRUNJRklFUiA/IERFRkFVTFQgOiBleHBvcnRzS2V5O1xuXG4gICAgICBpZiAodHlwZW9mIGV4cG9ydFN0YXRlbWVudCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgaWYgKGV4cG9ydFN0YXRlbWVudC53aGVyZVVzZWQuc2l6ZSA8IDEpIHtcbiAgICAgICAgICBjb250ZXh0LnJlcG9ydChcbiAgICAgICAgICAgIG5vZGUsXG4gICAgICAgICAgICBgZXhwb3J0ZWQgZGVjbGFyYXRpb24gJyR7dmFsdWV9JyBub3QgdXNlZCB3aXRoaW4gb3RoZXIgbW9kdWxlc2AsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29udGV4dC5yZXBvcnQoXG4gICAgICAgICAgbm9kZSxcbiAgICAgICAgICBgZXhwb3J0ZWQgZGVjbGFyYXRpb24gJyR7dmFsdWV9JyBub3QgdXNlZCB3aXRoaW4gb3RoZXIgbW9kdWxlc2AsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIG9ubHkgdXNlZnVsIGZvciB0b29scyBsaWtlIHZzY29kZS1lc2xpbnRcbiAgICAgKlxuICAgICAqIHVwZGF0ZSBsaXN0cyBvZiBleGlzdGluZyBleHBvcnRzIGR1cmluZyBydW50aW1lXG4gICAgICovXG4gICAgY29uc3QgdXBkYXRlRXhwb3J0VXNhZ2UgPSAobm9kZSkgPT4ge1xuICAgICAgaWYgKGlnbm9yZWRGaWxlcy5oYXMoZmlsZSkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBsZXQgZXhwb3J0cyA9IGV4cG9ydExpc3QuZ2V0KGZpbGUpO1xuXG4gICAgICAvLyBuZXcgbW9kdWxlIGhhcyBiZWVuIGNyZWF0ZWQgZHVyaW5nIHJ1bnRpbWVcbiAgICAgIC8vIGluY2x1ZGUgaXQgaW4gZnVydGhlciBwcm9jZXNzaW5nXG4gICAgICBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGV4cG9ydHMgPSBuZXcgTWFwKCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG5ld0V4cG9ydHMgPSBuZXcgTWFwKCk7XG4gICAgICBjb25zdCBuZXdFeHBvcnRJZGVudGlmaWVycyA9IG5ldyBTZXQoKTtcblxuICAgICAgbm9kZS5ib2R5LmZvckVhY2goKHsgdHlwZSwgZGVjbGFyYXRpb24sIHNwZWNpZmllcnMgfSkgPT4ge1xuICAgICAgICBpZiAodHlwZSA9PT0gRVhQT1JUX0RFRkFVTFRfREVDTEFSQVRJT04pIHtcbiAgICAgICAgICBuZXdFeHBvcnRJZGVudGlmaWVycy5hZGQoSU1QT1JUX0RFRkFVTFRfU1BFQ0lGSUVSKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZSA9PT0gRVhQT1JUX05BTUVEX0RFQ0xBUkFUSU9OKSB7XG4gICAgICAgICAgaWYgKHNwZWNpZmllcnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgc3BlY2lmaWVycy5mb3JFYWNoKChzcGVjaWZpZXIpID0+IHtcbiAgICAgICAgICAgICAgaWYgKHNwZWNpZmllci5leHBvcnRlZCkge1xuICAgICAgICAgICAgICAgIG5ld0V4cG9ydElkZW50aWZpZXJzLmFkZChzcGVjaWZpZXIuZXhwb3J0ZWQubmFtZSB8fCBzcGVjaWZpZXIuZXhwb3J0ZWQudmFsdWUpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZm9yRWFjaERlY2xhcmF0aW9uSWRlbnRpZmllcihkZWNsYXJhdGlvbiwgKG5hbWUpID0+IHtcbiAgICAgICAgICAgIG5ld0V4cG9ydElkZW50aWZpZXJzLmFkZChuYW1lKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIC8vIG9sZCBleHBvcnRzIGV4aXN0IHdpdGhpbiBsaXN0IG9mIG5ldyBleHBvcnRzIGlkZW50aWZpZXJzOiBhZGQgdG8gbWFwIG9mIG5ldyBleHBvcnRzXG4gICAgICBleHBvcnRzLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgaWYgKG5ld0V4cG9ydElkZW50aWZpZXJzLmhhcyhrZXkpKSB7XG4gICAgICAgICAgbmV3RXhwb3J0cy5zZXQoa2V5LCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICAvLyBuZXcgZXhwb3J0IGlkZW50aWZpZXJzIGFkZGVkOiBhZGQgdG8gbWFwIG9mIG5ldyBleHBvcnRzXG4gICAgICBuZXdFeHBvcnRJZGVudGlmaWVycy5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgICAgaWYgKCFleHBvcnRzLmhhcyhrZXkpKSB7XG4gICAgICAgICAgbmV3RXhwb3J0cy5zZXQoa2V5LCB7IHdoZXJlVXNlZDogbmV3IFNldCgpIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gcHJlc2VydmUgaW5mb3JtYXRpb24gYWJvdXQgbmFtZXNwYWNlIGltcG9ydHNcbiAgICAgIGNvbnN0IGV4cG9ydEFsbCA9IGV4cG9ydHMuZ2V0KEVYUE9SVF9BTExfREVDTEFSQVRJT04pO1xuICAgICAgbGV0IG5hbWVzcGFjZUltcG9ydHMgPSBleHBvcnRzLmdldChJTVBPUlRfTkFNRVNQQUNFX1NQRUNJRklFUik7XG5cbiAgICAgIGlmICh0eXBlb2YgbmFtZXNwYWNlSW1wb3J0cyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgbmFtZXNwYWNlSW1wb3J0cyA9IHsgd2hlcmVVc2VkOiBuZXcgU2V0KCkgfTtcbiAgICAgIH1cblxuICAgICAgbmV3RXhwb3J0cy5zZXQoRVhQT1JUX0FMTF9ERUNMQVJBVElPTiwgZXhwb3J0QWxsKTtcbiAgICAgIG5ld0V4cG9ydHMuc2V0KElNUE9SVF9OQU1FU1BBQ0VfU1BFQ0lGSUVSLCBuYW1lc3BhY2VJbXBvcnRzKTtcbiAgICAgIGV4cG9ydExpc3Quc2V0KGZpbGUsIG5ld0V4cG9ydHMpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBvbmx5IHVzZWZ1bCBmb3IgdG9vbHMgbGlrZSB2c2NvZGUtZXNsaW50XG4gICAgICpcbiAgICAgKiB1cGRhdGUgbGlzdHMgb2YgZXhpc3RpbmcgaW1wb3J0cyBkdXJpbmcgcnVudGltZVxuICAgICAqL1xuICAgIGNvbnN0IHVwZGF0ZUltcG9ydFVzYWdlID0gKG5vZGUpID0+IHtcbiAgICAgIGlmICghdW51c2VkRXhwb3J0cykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGxldCBvbGRJbXBvcnRQYXRocyA9IGltcG9ydExpc3QuZ2V0KGZpbGUpO1xuICAgICAgaWYgKHR5cGVvZiBvbGRJbXBvcnRQYXRocyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgb2xkSW1wb3J0UGF0aHMgPSBuZXcgTWFwKCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG9sZE5hbWVzcGFjZUltcG9ydHMgPSBuZXcgU2V0KCk7XG4gICAgICBjb25zdCBuZXdOYW1lc3BhY2VJbXBvcnRzID0gbmV3IFNldCgpO1xuXG4gICAgICBjb25zdCBvbGRFeHBvcnRBbGwgPSBuZXcgU2V0KCk7XG4gICAgICBjb25zdCBuZXdFeHBvcnRBbGwgPSBuZXcgU2V0KCk7XG5cbiAgICAgIGNvbnN0IG9sZERlZmF1bHRJbXBvcnRzID0gbmV3IFNldCgpO1xuICAgICAgY29uc3QgbmV3RGVmYXVsdEltcG9ydHMgPSBuZXcgU2V0KCk7XG5cbiAgICAgIGNvbnN0IG9sZEltcG9ydHMgPSBuZXcgTWFwKCk7XG4gICAgICBjb25zdCBuZXdJbXBvcnRzID0gbmV3IE1hcCgpO1xuICAgICAgb2xkSW1wb3J0UGF0aHMuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuICAgICAgICBpZiAodmFsdWUuaGFzKEVYUE9SVF9BTExfREVDTEFSQVRJT04pKSB7XG4gICAgICAgICAgb2xkRXhwb3J0QWxsLmFkZChrZXkpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh2YWx1ZS5oYXMoSU1QT1JUX05BTUVTUEFDRV9TUEVDSUZJRVIpKSB7XG4gICAgICAgICAgb2xkTmFtZXNwYWNlSW1wb3J0cy5hZGQoa2V5KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodmFsdWUuaGFzKElNUE9SVF9ERUZBVUxUX1NQRUNJRklFUikpIHtcbiAgICAgICAgICBvbGREZWZhdWx0SW1wb3J0cy5hZGQoa2V5KTtcbiAgICAgICAgfVxuICAgICAgICB2YWx1ZS5mb3JFYWNoKCh2YWwpID0+IHtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICB2YWwgIT09IElNUE9SVF9OQU1FU1BBQ0VfU1BFQ0lGSUVSXG4gICAgICAgICAgICAmJiB2YWwgIT09IElNUE9SVF9ERUZBVUxUX1NQRUNJRklFUlxuICAgICAgICAgICkge1xuICAgICAgICAgICAgb2xkSW1wb3J0cy5zZXQodmFsLCBrZXkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgZnVuY3Rpb24gcHJvY2Vzc0R5bmFtaWNJbXBvcnQoc291cmNlKSB7XG4gICAgICAgIGlmIChzb3VyY2UudHlwZSAhPT0gJ0xpdGVyYWwnKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcCA9IHJlc29sdmUoc291cmNlLnZhbHVlLCBjb250ZXh0KTtcbiAgICAgICAgaWYgKHAgPT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIG5ld05hbWVzcGFjZUltcG9ydHMuYWRkKHApO1xuICAgICAgfVxuXG4gICAgICB2aXNpdChub2RlLCB2aXNpdG9yS2V5TWFwLmdldChmaWxlKSwge1xuICAgICAgICBJbXBvcnRFeHByZXNzaW9uKGNoaWxkKSB7XG4gICAgICAgICAgcHJvY2Vzc0R5bmFtaWNJbXBvcnQoY2hpbGQuc291cmNlKTtcbiAgICAgICAgfSxcbiAgICAgICAgQ2FsbEV4cHJlc3Npb24oY2hpbGQpIHtcbiAgICAgICAgICBpZiAoY2hpbGQuY2FsbGVlLnR5cGUgPT09ICdJbXBvcnQnKSB7XG4gICAgICAgICAgICBwcm9jZXNzRHluYW1pY0ltcG9ydChjaGlsZC5hcmd1bWVudHNbMF0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBub2RlLmJvZHkuZm9yRWFjaCgoYXN0Tm9kZSkgPT4ge1xuICAgICAgICBsZXQgcmVzb2x2ZWRQYXRoO1xuXG4gICAgICAgIC8vIHN1cHBvcnQgZm9yIGV4cG9ydCB7IHZhbHVlIH0gZnJvbSAnbW9kdWxlJ1xuICAgICAgICBpZiAoYXN0Tm9kZS50eXBlID09PSBFWFBPUlRfTkFNRURfREVDTEFSQVRJT04pIHtcbiAgICAgICAgICBpZiAoYXN0Tm9kZS5zb3VyY2UpIHtcbiAgICAgICAgICAgIHJlc29sdmVkUGF0aCA9IHJlc29sdmUoYXN0Tm9kZS5zb3VyY2UucmF3LnJlcGxhY2UoLygnfFwiKS9nLCAnJyksIGNvbnRleHQpO1xuICAgICAgICAgICAgYXN0Tm9kZS5zcGVjaWZpZXJzLmZvckVhY2goKHNwZWNpZmllcikgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBuYW1lID0gc3BlY2lmaWVyLmxvY2FsLm5hbWUgfHwgc3BlY2lmaWVyLmxvY2FsLnZhbHVlO1xuICAgICAgICAgICAgICBpZiAobmFtZSA9PT0gREVGQVVMVCkge1xuICAgICAgICAgICAgICAgIG5ld0RlZmF1bHRJbXBvcnRzLmFkZChyZXNvbHZlZFBhdGgpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5ld0ltcG9ydHMuc2V0KG5hbWUsIHJlc29sdmVkUGF0aCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhc3ROb2RlLnR5cGUgPT09IEVYUE9SVF9BTExfREVDTEFSQVRJT04pIHtcbiAgICAgICAgICByZXNvbHZlZFBhdGggPSByZXNvbHZlKGFzdE5vZGUuc291cmNlLnJhdy5yZXBsYWNlKC8oJ3xcIikvZywgJycpLCBjb250ZXh0KTtcbiAgICAgICAgICBuZXdFeHBvcnRBbGwuYWRkKHJlc29sdmVkUGF0aCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYXN0Tm9kZS50eXBlID09PSBJTVBPUlRfREVDTEFSQVRJT04pIHtcbiAgICAgICAgICByZXNvbHZlZFBhdGggPSByZXNvbHZlKGFzdE5vZGUuc291cmNlLnJhdy5yZXBsYWNlKC8oJ3xcIikvZywgJycpLCBjb250ZXh0KTtcbiAgICAgICAgICBpZiAoIXJlc29sdmVkUGF0aCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChpc05vZGVNb2R1bGUocmVzb2x2ZWRQYXRoKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChuZXdOYW1lc3BhY2VJbXBvcnRFeGlzdHMoYXN0Tm9kZS5zcGVjaWZpZXJzKSkge1xuICAgICAgICAgICAgbmV3TmFtZXNwYWNlSW1wb3J0cy5hZGQocmVzb2x2ZWRQYXRoKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAobmV3RGVmYXVsdEltcG9ydEV4aXN0cyhhc3ROb2RlLnNwZWNpZmllcnMpKSB7XG4gICAgICAgICAgICBuZXdEZWZhdWx0SW1wb3J0cy5hZGQocmVzb2x2ZWRQYXRoKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBhc3ROb2RlLnNwZWNpZmllcnNcbiAgICAgICAgICAgIC5maWx0ZXIoKHNwZWNpZmllcikgPT4gc3BlY2lmaWVyLnR5cGUgIT09IElNUE9SVF9ERUZBVUxUX1NQRUNJRklFUiAmJiBzcGVjaWZpZXIudHlwZSAhPT0gSU1QT1JUX05BTUVTUEFDRV9TUEVDSUZJRVIpXG4gICAgICAgICAgICAuZm9yRWFjaCgoc3BlY2lmaWVyKSA9PiB7XG4gICAgICAgICAgICAgIG5ld0ltcG9ydHMuc2V0KHNwZWNpZmllci5pbXBvcnRlZC5uYW1lIHx8IHNwZWNpZmllci5pbXBvcnRlZC52YWx1ZSwgcmVzb2x2ZWRQYXRoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgbmV3RXhwb3J0QWxsLmZvckVhY2goKHZhbHVlKSA9PiB7XG4gICAgICAgIGlmICghb2xkRXhwb3J0QWxsLmhhcyh2YWx1ZSkpIHtcbiAgICAgICAgICBsZXQgaW1wb3J0cyA9IG9sZEltcG9ydFBhdGhzLmdldCh2YWx1ZSk7XG4gICAgICAgICAgaWYgKHR5cGVvZiBpbXBvcnRzID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgaW1wb3J0cyA9IG5ldyBTZXQoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaW1wb3J0cy5hZGQoRVhQT1JUX0FMTF9ERUNMQVJBVElPTik7XG4gICAgICAgICAgb2xkSW1wb3J0UGF0aHMuc2V0KHZhbHVlLCBpbXBvcnRzKTtcblxuICAgICAgICAgIGxldCBleHBvcnRzID0gZXhwb3J0TGlzdC5nZXQodmFsdWUpO1xuICAgICAgICAgIGxldCBjdXJyZW50RXhwb3J0O1xuICAgICAgICAgIGlmICh0eXBlb2YgZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGN1cnJlbnRFeHBvcnQgPSBleHBvcnRzLmdldChFWFBPUlRfQUxMX0RFQ0xBUkFUSU9OKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZXhwb3J0cyA9IG5ldyBNYXAoKTtcbiAgICAgICAgICAgIGV4cG9ydExpc3Quc2V0KHZhbHVlLCBleHBvcnRzKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAodHlwZW9mIGN1cnJlbnRFeHBvcnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBjdXJyZW50RXhwb3J0LndoZXJlVXNlZC5hZGQoZmlsZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHdoZXJlVXNlZCA9IG5ldyBTZXQoKTtcbiAgICAgICAgICAgIHdoZXJlVXNlZC5hZGQoZmlsZSk7XG4gICAgICAgICAgICBleHBvcnRzLnNldChFWFBPUlRfQUxMX0RFQ0xBUkFUSU9OLCB7IHdoZXJlVXNlZCB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBvbGRFeHBvcnRBbGwuZm9yRWFjaCgodmFsdWUpID0+IHtcbiAgICAgICAgaWYgKCFuZXdFeHBvcnRBbGwuaGFzKHZhbHVlKSkge1xuICAgICAgICAgIGNvbnN0IGltcG9ydHMgPSBvbGRJbXBvcnRQYXRocy5nZXQodmFsdWUpO1xuICAgICAgICAgIGltcG9ydHMuZGVsZXRlKEVYUE9SVF9BTExfREVDTEFSQVRJT04pO1xuXG4gICAgICAgICAgY29uc3QgZXhwb3J0cyA9IGV4cG9ydExpc3QuZ2V0KHZhbHVlKTtcbiAgICAgICAgICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBjb25zdCBjdXJyZW50RXhwb3J0ID0gZXhwb3J0cy5nZXQoRVhQT1JUX0FMTF9ERUNMQVJBVElPTik7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGN1cnJlbnRFeHBvcnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgIGN1cnJlbnRFeHBvcnQud2hlcmVVc2VkLmRlbGV0ZShmaWxlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBuZXdEZWZhdWx0SW1wb3J0cy5mb3JFYWNoKCh2YWx1ZSkgPT4ge1xuICAgICAgICBpZiAoIW9sZERlZmF1bHRJbXBvcnRzLmhhcyh2YWx1ZSkpIHtcbiAgICAgICAgICBsZXQgaW1wb3J0cyA9IG9sZEltcG9ydFBhdGhzLmdldCh2YWx1ZSk7XG4gICAgICAgICAgaWYgKHR5cGVvZiBpbXBvcnRzID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgaW1wb3J0cyA9IG5ldyBTZXQoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaW1wb3J0cy5hZGQoSU1QT1JUX0RFRkFVTFRfU1BFQ0lGSUVSKTtcbiAgICAgICAgICBvbGRJbXBvcnRQYXRocy5zZXQodmFsdWUsIGltcG9ydHMpO1xuXG4gICAgICAgICAgbGV0IGV4cG9ydHMgPSBleHBvcnRMaXN0LmdldCh2YWx1ZSk7XG4gICAgICAgICAgbGV0IGN1cnJlbnRFeHBvcnQ7XG4gICAgICAgICAgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgY3VycmVudEV4cG9ydCA9IGV4cG9ydHMuZ2V0KElNUE9SVF9ERUZBVUxUX1NQRUNJRklFUik7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGV4cG9ydHMgPSBuZXcgTWFwKCk7XG4gICAgICAgICAgICBleHBvcnRMaXN0LnNldCh2YWx1ZSwgZXhwb3J0cyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHR5cGVvZiBjdXJyZW50RXhwb3J0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgY3VycmVudEV4cG9ydC53aGVyZVVzZWQuYWRkKGZpbGUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCB3aGVyZVVzZWQgPSBuZXcgU2V0KCk7XG4gICAgICAgICAgICB3aGVyZVVzZWQuYWRkKGZpbGUpO1xuICAgICAgICAgICAgZXhwb3J0cy5zZXQoSU1QT1JUX0RFRkFVTFRfU1BFQ0lGSUVSLCB7IHdoZXJlVXNlZCB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBvbGREZWZhdWx0SW1wb3J0cy5mb3JFYWNoKCh2YWx1ZSkgPT4ge1xuICAgICAgICBpZiAoIW5ld0RlZmF1bHRJbXBvcnRzLmhhcyh2YWx1ZSkpIHtcbiAgICAgICAgICBjb25zdCBpbXBvcnRzID0gb2xkSW1wb3J0UGF0aHMuZ2V0KHZhbHVlKTtcbiAgICAgICAgICBpbXBvcnRzLmRlbGV0ZShJTVBPUlRfREVGQVVMVF9TUEVDSUZJRVIpO1xuXG4gICAgICAgICAgY29uc3QgZXhwb3J0cyA9IGV4cG9ydExpc3QuZ2V0KHZhbHVlKTtcbiAgICAgICAgICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBjb25zdCBjdXJyZW50RXhwb3J0ID0gZXhwb3J0cy5nZXQoSU1QT1JUX0RFRkFVTFRfU1BFQ0lGSUVSKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgY3VycmVudEV4cG9ydCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgY3VycmVudEV4cG9ydC53aGVyZVVzZWQuZGVsZXRlKGZpbGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIG5ld05hbWVzcGFjZUltcG9ydHMuZm9yRWFjaCgodmFsdWUpID0+IHtcbiAgICAgICAgaWYgKCFvbGROYW1lc3BhY2VJbXBvcnRzLmhhcyh2YWx1ZSkpIHtcbiAgICAgICAgICBsZXQgaW1wb3J0cyA9IG9sZEltcG9ydFBhdGhzLmdldCh2YWx1ZSk7XG4gICAgICAgICAgaWYgKHR5cGVvZiBpbXBvcnRzID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgaW1wb3J0cyA9IG5ldyBTZXQoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaW1wb3J0cy5hZGQoSU1QT1JUX05BTUVTUEFDRV9TUEVDSUZJRVIpO1xuICAgICAgICAgIG9sZEltcG9ydFBhdGhzLnNldCh2YWx1ZSwgaW1wb3J0cyk7XG5cbiAgICAgICAgICBsZXQgZXhwb3J0cyA9IGV4cG9ydExpc3QuZ2V0KHZhbHVlKTtcbiAgICAgICAgICBsZXQgY3VycmVudEV4cG9ydDtcbiAgICAgICAgICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBjdXJyZW50RXhwb3J0ID0gZXhwb3J0cy5nZXQoSU1QT1JUX05BTUVTUEFDRV9TUEVDSUZJRVIpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBleHBvcnRzID0gbmV3IE1hcCgpO1xuICAgICAgICAgICAgZXhwb3J0TGlzdC5zZXQodmFsdWUsIGV4cG9ydHMpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICh0eXBlb2YgY3VycmVudEV4cG9ydCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGN1cnJlbnRFeHBvcnQud2hlcmVVc2VkLmFkZChmaWxlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgd2hlcmVVc2VkID0gbmV3IFNldCgpO1xuICAgICAgICAgICAgd2hlcmVVc2VkLmFkZChmaWxlKTtcbiAgICAgICAgICAgIGV4cG9ydHMuc2V0KElNUE9SVF9OQU1FU1BBQ0VfU1BFQ0lGSUVSLCB7IHdoZXJlVXNlZCB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBvbGROYW1lc3BhY2VJbXBvcnRzLmZvckVhY2goKHZhbHVlKSA9PiB7XG4gICAgICAgIGlmICghbmV3TmFtZXNwYWNlSW1wb3J0cy5oYXModmFsdWUpKSB7XG4gICAgICAgICAgY29uc3QgaW1wb3J0cyA9IG9sZEltcG9ydFBhdGhzLmdldCh2YWx1ZSk7XG4gICAgICAgICAgaW1wb3J0cy5kZWxldGUoSU1QT1JUX05BTUVTUEFDRV9TUEVDSUZJRVIpO1xuXG4gICAgICAgICAgY29uc3QgZXhwb3J0cyA9IGV4cG9ydExpc3QuZ2V0KHZhbHVlKTtcbiAgICAgICAgICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBjb25zdCBjdXJyZW50RXhwb3J0ID0gZXhwb3J0cy5nZXQoSU1QT1JUX05BTUVTUEFDRV9TUEVDSUZJRVIpO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBjdXJyZW50RXhwb3J0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICBjdXJyZW50RXhwb3J0LndoZXJlVXNlZC5kZWxldGUoZmlsZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgbmV3SW1wb3J0cy5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiB7XG4gICAgICAgIGlmICghb2xkSW1wb3J0cy5oYXMoa2V5KSkge1xuICAgICAgICAgIGxldCBpbXBvcnRzID0gb2xkSW1wb3J0UGF0aHMuZ2V0KHZhbHVlKTtcbiAgICAgICAgICBpZiAodHlwZW9mIGltcG9ydHMgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBpbXBvcnRzID0gbmV3IFNldCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpbXBvcnRzLmFkZChrZXkpO1xuICAgICAgICAgIG9sZEltcG9ydFBhdGhzLnNldCh2YWx1ZSwgaW1wb3J0cyk7XG5cbiAgICAgICAgICBsZXQgZXhwb3J0cyA9IGV4cG9ydExpc3QuZ2V0KHZhbHVlKTtcbiAgICAgICAgICBsZXQgY3VycmVudEV4cG9ydDtcbiAgICAgICAgICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBjdXJyZW50RXhwb3J0ID0gZXhwb3J0cy5nZXQoa2V5KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZXhwb3J0cyA9IG5ldyBNYXAoKTtcbiAgICAgICAgICAgIGV4cG9ydExpc3Quc2V0KHZhbHVlLCBleHBvcnRzKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAodHlwZW9mIGN1cnJlbnRFeHBvcnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBjdXJyZW50RXhwb3J0LndoZXJlVXNlZC5hZGQoZmlsZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHdoZXJlVXNlZCA9IG5ldyBTZXQoKTtcbiAgICAgICAgICAgIHdoZXJlVXNlZC5hZGQoZmlsZSk7XG4gICAgICAgICAgICBleHBvcnRzLnNldChrZXksIHsgd2hlcmVVc2VkIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIG9sZEltcG9ydHMuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuICAgICAgICBpZiAoIW5ld0ltcG9ydHMuaGFzKGtleSkpIHtcbiAgICAgICAgICBjb25zdCBpbXBvcnRzID0gb2xkSW1wb3J0UGF0aHMuZ2V0KHZhbHVlKTtcbiAgICAgICAgICBpbXBvcnRzLmRlbGV0ZShrZXkpO1xuXG4gICAgICAgICAgY29uc3QgZXhwb3J0cyA9IGV4cG9ydExpc3QuZ2V0KHZhbHVlKTtcbiAgICAgICAgICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBjb25zdCBjdXJyZW50RXhwb3J0ID0gZXhwb3J0cy5nZXQoa2V5KTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgY3VycmVudEV4cG9ydCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgY3VycmVudEV4cG9ydC53aGVyZVVzZWQuZGVsZXRlKGZpbGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfTtcblxuICAgIHJldHVybiB7XG4gICAgICAnUHJvZ3JhbTpleGl0Jyhub2RlKSB7XG4gICAgICAgIHVwZGF0ZUV4cG9ydFVzYWdlKG5vZGUpO1xuICAgICAgICB1cGRhdGVJbXBvcnRVc2FnZShub2RlKTtcbiAgICAgICAgY2hlY2tFeHBvcnRQcmVzZW5jZShub2RlKTtcbiAgICAgIH0sXG4gICAgICBFeHBvcnREZWZhdWx0RGVjbGFyYXRpb24obm9kZSkge1xuICAgICAgICBjaGVja1VzYWdlKG5vZGUsIElNUE9SVF9ERUZBVUxUX1NQRUNJRklFUiwgZmFsc2UpO1xuICAgICAgfSxcbiAgICAgIEV4cG9ydE5hbWVkRGVjbGFyYXRpb24obm9kZSkge1xuICAgICAgICBub2RlLnNwZWNpZmllcnMuZm9yRWFjaCgoc3BlY2lmaWVyKSA9PiB7XG4gICAgICAgICAgY2hlY2tVc2FnZShzcGVjaWZpZXIsIHNwZWNpZmllci5leHBvcnRlZC5uYW1lIHx8IHNwZWNpZmllci5leHBvcnRlZC52YWx1ZSwgZmFsc2UpO1xuICAgICAgICB9KTtcbiAgICAgICAgZm9yRWFjaERlY2xhcmF0aW9uSWRlbnRpZmllcihub2RlLmRlY2xhcmF0aW9uLCAobmFtZSwgaXNUeXBlRXhwb3J0KSA9PiB7XG4gICAgICAgICAgY2hlY2tVc2FnZShub2RlLCBuYW1lLCBpc1R5cGVFeHBvcnQpO1xuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgfTtcbiAgfSxcbn07XG4iXX0=