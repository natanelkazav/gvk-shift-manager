import fs from "node:fs";
import path from "node:path";

/*
 * =========================================================
 * GVK Shift Manager
 * Remote Supabase Smoke Test
 * =========================================================
 *
 * מטרות:
 * - לוודא שסביבת Supabase המרוחקת זמינה.
 * - לוודא ש-PostgREST נגיש.
 * - לוודא ש-Edge Functions שהקוד משתמש בהן פרוסות.
 * - אם קיים SUPABASE_SECRET_KEY:
 *   לבדוק גם שכל ה-RPCs שה-frontend משתמש בהם פרוסים.
 *
 * בטיחות:
 * - הבדיקה READ ONLY.
 * - לא יוצרת משתמשים.
 * - לא משנה שיבוצים.
 * - לא מפרסמת לוחות.
 * - לא שולחת התראות.
 * - לא מפעילה RPCs עסקיים.
 */


/*
 * =========================================================
 * Configuration
 * =========================================================
 */

const REQUEST_TIMEOUT_MS = 15_000;

const SOURCE_EXTENSIONS =
  /\.(ts|tsx)$/;


/*
 * =========================================================
 * Environment
 * =========================================================
 */

const getEnvironment = () => {
  const supabaseUrl =
    process.env
      .VITE_SUPABASE_URL;

  const publishableKey =
    process.env
      .VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env
      .VITE_SUPABASE_ANON_KEY;

  /*
   * אופציונלי בלבד.
   *
   * אין לשים אותו ב-VITE_*.
   * אין לחשוף אותו ל-frontend.
   *
   * אם הוא קיים בסביבת CI / Local,
   * נוכל לקרוא גם את OpenAPI catalog.
   */
  const secretKey =
    process.env
      .SUPABASE_SECRET_KEY;

  return {
    supabaseUrl,
    publishableKey,
    secretKey,
  };
};


/*
 * =========================================================
 * File discovery
 * =========================================================
 */

const collectSourceFiles = (
  rootDirectory,
) => {
  const result = [];

  if (
    !fs.existsSync(
      rootDirectory,
    )
  ) {
    return result;
  }

  const walk = (
    directory,
  ) => {
    const entries =
      fs.readdirSync(
        directory,
        {
          withFileTypes:
            true,
        },
      );

    for (
      const entry
      of entries
    ) {
      const fullPath =
        path.join(
          directory,
          entry.name,
        );

      if (
        entry.isDirectory()
      ) {
        walk(
          fullPath,
        );

        continue;
      }

      if (
        SOURCE_EXTENSIONS
          .test(
            fullPath,
          )
      ) {
        result.push(
          fullPath,
        );
      }
    }
  };

  walk(
    rootDirectory,
  );

  return result;
};


/*
 * =========================================================
 * Frontend contract discovery
 * =========================================================
 */

const collectRemoteContracts = (
  files,
) => {
  const rpcNames =
    new Set();

  const edgeFunctionNames =
    new Set();

  for (
    const file
    of files
  ) {
    const text =
      fs.readFileSync(
        file,
        "utf8",
      );


    /*
     * Supabase RPC:
     *
     * supabase.rpc(
     *   "function_name",
     * )
     */
    for (
      const match
      of text.matchAll(
        /\.rpc\(\s*["']([^"']+)["']/g,
      )
    ) {
      rpcNames.add(
        match[1],
      );
    }


    /*
     * Edge Functions:
     *
     * supabase.functions.invoke(
     *   "function-name",
     * )
     */
    for (
      const match
      of text.matchAll(
        /\.functions\.invoke\(\s*["']([^"']+)["']/g,
      )
    ) {
      edgeFunctionNames.add(
        match[1],
      );
    }
  }

  return {
    rpcNames,
    edgeFunctionNames,
  };
};


/*
 * =========================================================
 * HTTP helper
 * =========================================================
 */

const fetchWithTimeout = async (
  url,
  options = {},
  timeoutMilliseconds =
    REQUEST_TIMEOUT_MS,
) => {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => {
        controller.abort();
      },
      timeoutMilliseconds,
    );

  try {
    return await fetch(
      url,
      {
        ...options,

        signal:
          controller.signal,
      },
    );
  } finally {
    clearTimeout(
      timer,
    );
  }
};


/*
 * =========================================================
 * Output helpers
 * =========================================================
 */

const printSection = (
  title,
) => {
  console.log("");

  console.log(
    title,
  );

  console.log(
    "-".repeat(
      Math.max(
        20,
        title.length,
      ),
    ),
  );
};


const printSuccess = (
  message,
) => {
  console.log(
    `✓ ${message}`,
  );
};


const printWarning = (
  message,
) => {
  console.warn(
    `⚠ ${message}`,
  );
};


const printFailure = (
  message,
) => {
  console.error(
    `✗ ${message}`,
  );
};


/*
 * =========================================================
 * Main
 * =========================================================
 */

const main = async () => {
  const {
    supabaseUrl,
    publishableKey,
    secretKey,
  } =
    getEnvironment();


  /*
   * -------------------------------------------------------
   * Validate environment
   * -------------------------------------------------------
   */

  if (
    !supabaseUrl ||
    !publishableKey
  ) {
    printFailure(
      "Missing Supabase environment variables.",
    );

    console.error("");

    console.error(
      "Expected:",
    );

    console.error(
      "  VITE_SUPABASE_URL",
    );

    console.error(
      "  VITE_SUPABASE_PUBLISHABLE_KEY",
    );

    console.error("");

    console.error(
      "No remote changes were made.",
    );

    process.exitCode = 2;

    return;
  }


  const baseUrl =
    supabaseUrl.replace(
      /\/$/,
      "",
    );


  const sourceDirectory =
    path.join(
      process.cwd(),
      "src",
    );


  const sourceFiles =
    collectSourceFiles(
      sourceDirectory,
    );


  const {
    rpcNames,
    edgeFunctionNames,
  } =
    collectRemoteContracts(
      sourceFiles,
    );


  /*
   * -------------------------------------------------------
   * Header
   * -------------------------------------------------------
   */

  console.log("");

  console.log(
    "GVK Shift Manager - Remote Smoke Test",
  );

  console.log(
    "=====================================",
  );

  console.log(
    `Supabase: ${baseUrl}`,
  );

  console.log(
    "Mode: READ ONLY",
  );

  console.log(
    `RPC contracts discovered: ${rpcNames.size}`,
  );

  console.log(
    `Edge Functions discovered: ${edgeFunctionNames.size}`,
  );


  let failureCount = 0;
  let warningCount = 0;


  /*
   * =======================================================
   * 1. Supabase Auth health
   * =======================================================
   */

  printSection(
    "1. Supabase connectivity",
  );


  try {
    const response =
      await fetchWithTimeout(
        `${baseUrl}/auth/v1/health`,
        {
          method:
            "GET",

          headers: {
            apikey:
              publishableKey,
          },
        },
      );


    if (
      response.ok
    ) {
      printSuccess(
        "Supabase Auth is reachable",
      );
    } else {
      failureCount += 1;

      printFailure(
        `Supabase Auth health returned HTTP ${response.status}`,
      );
    }
  } catch (error) {
    failureCount += 1;

    printFailure(
      `Could not reach Supabase Auth: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    );
  }


  /*
   * =======================================================
   * 2. PostgREST connectivity
   * =======================================================
   *
   * Supabase no longer permits reading the root OpenAPI
   * catalog with a normal Publishable Key.
   *
   * Therefore we use a harmless GET against profiles with
   * limit=0.
   *
   * No rows are requested.
   * No data is modified.
   * =======================================================
   */

  printSection(
    "2. PostgREST connectivity",
  );


  try {
    const response =
      await fetchWithTimeout(
        `${baseUrl}/rest/v1/profiles?select=id&limit=0`,
        {
          method:
            "GET",

          headers: {
            apikey:
              publishableKey,

            Accept:
              "application/json",
          },
        },
      );


    /*
     * 200:
     *   PostgREST + RLS allowed the request.
     *
     * 401 / 403:
     *   PostgREST exists but anonymous access is protected.
     *
     * Both prove that PostgREST itself is reachable.
     */
    if (
      response.ok
    ) {
      printSuccess(
        "PostgREST is reachable",
      );
    } else if (
      response.status === 401 ||
      response.status === 403
    ) {
      printSuccess(
        `PostgREST is reachable and protected (HTTP ${response.status})`,
      );
    } else {
      failureCount += 1;

      const body =
        await response
          .text()
          .catch(
            () => "",
          );

      printFailure(
        `PostgREST returned HTTP ${response.status}`,
      );

      if (
        body
      ) {
        console.error(
          `  ${body.slice(
            0,
            500,
          )}`,
        );
      }
    }
  } catch (error) {
    failureCount += 1;

    printFailure(
      `Could not reach PostgREST: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    );
  }


  /*
   * =======================================================
   * 3. Remote RPC catalog
   * =======================================================
   *
   * Reading OpenAPI requires a Secret API key.
   *
   * We intentionally DO NOT invoke application RPCs just
   * to determine whether they exist, because some of them
   * mutate data.
   *
   * Without SUPABASE_SECRET_KEY:
   * - skip this remote check
   * - rely on npm run test:contracts
   *
   * With SUPABASE_SECRET_KEY:
   * - inspect the OpenAPI catalog only
   * - still do not execute the RPCs
   * =======================================================
   */

  printSection(
    "3. RPC deployment contracts",
  );


  if (
    !secretKey
  ) {
    warningCount += 1;

    printWarning(
      "SUPABASE_SECRET_KEY is not configured.",
    );

    console.log(
      "  Remote RPC catalog check was skipped.",
    );

    console.log(
      "  This is expected for normal local development.",
    );

    console.log(
      "  Run `npm run test:contracts` for repository RPC validation.",
    );

    console.log(
      "  A Secret API key should only be configured locally/CI, never as VITE_*.",
    );
  } else {
    try {
      const response =
        await fetchWithTimeout(
          `${baseUrl}/rest/v1/`,
          {
            method:
              "GET",

            headers: {
              apikey:
                secretKey,

              Accept:
                "application/openapi+json",
            },
          },
        );


      if (
        !response.ok
      ) {
        warningCount += 1;

        const body =
          await response
            .text()
            .catch(
              () => "",
            );

        printWarning(
          `Could not read PostgREST OpenAPI catalog: HTTP ${response.status}`,
        );

        if (
          body
        ) {
          console.warn(
            `  ${body.slice(
              0,
              500,
            )}`,
          );
        }
      } else {
        const openApi =
          await response.json();


        const deployedPaths =
          new Set(
            Object.keys(
              openApi.paths ??
                {},
            ),
          );


        const missingRpcs =
          [...rpcNames]
            .filter(
              (
                rpcName,
              ) =>
                !deployedPaths.has(
                  `/rpc/${rpcName}`,
                ),
            )
            .sort();


        const foundCount =
          rpcNames.size -
          missingRpcs.length;


        printSuccess(
          `${foundCount}/${rpcNames.size} frontend RPC contracts are deployed`,
        );


        if (
          missingRpcs.length >
          0
        ) {
          failureCount +=
            missingRpcs.length;

          console.error("");

          console.error(
            "Missing RPCs:",
          );


          for (
            const rpcName
            of missingRpcs
          ) {
            console.error(
              `  ✗ ${rpcName}`,
            );
          }
        }
      }
    } catch (error) {
      warningCount += 1;

      printWarning(
        `RPC catalog check failed: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );
    }
  }


  /*
   * =======================================================
   * 4. Edge Function deployment
   * =======================================================
   *
   * OPTIONS is used to avoid invoking business logic.
   *
   * 404:
   *   endpoint does not exist.
   *
   * 401 / 403 / 405:
   *   endpoint exists but is protected / does not accept
   *   OPTIONS in the expected manner.
   *
   * These still prove that the deployed route exists.
   * =======================================================
   */

  printSection(
    "4. Edge Function deployment",
  );


  if (
    edgeFunctionNames.size ===
    0
  ) {
    printSuccess(
      "No Edge Function contracts were discovered",
    );
  } else {
    const missingFunctions = [];
    const connectivityErrors = [];


    for (
      const functionName
      of [...edgeFunctionNames]
        .sort()
    ) {
      try {
        const response =
          await fetchWithTimeout(
            `${baseUrl}/functions/v1/${functionName}`,
            {
              method:
                "OPTIONS",

              headers: {
                apikey:
                  publishableKey,
              },
            },
          );


        if (
          response.status ===
          404
        ) {
          missingFunctions.push(
            functionName,
          );
        }
      } catch (error) {
        connectivityErrors.push({
          functionName,

          message:
            error instanceof Error
              ? error.message
              : String(error),
        });
      }
    }


    const reachableCount =
      edgeFunctionNames.size -
      missingFunctions.length -
      connectivityErrors.length;


    printSuccess(
      `${reachableCount}/${edgeFunctionNames.size} Edge Function endpoints are reachable`,
    );


    if (
      missingFunctions.length >
      0
    ) {
      failureCount +=
        missingFunctions.length;

      console.error("");

      console.error(
        "Missing Edge Functions:",
      );


      for (
        const functionName
        of missingFunctions
      ) {
        console.error(
          `  ✗ ${functionName}`,
        );
      }
    }


    if (
      connectivityErrors.length >
      0
    ) {
      failureCount +=
        connectivityErrors.length;

      console.error("");

      console.error(
        "Edge Function connectivity errors:",
      );


      for (
        const item
        of connectivityErrors
      ) {
        console.error(
          `  ✗ ${item.functionName}: ${item.message}`,
        );
      }
    }
  }


  /*
   * =======================================================
   * Final result
   * =======================================================
   */

  console.log("");

  console.log(
    "=====================================",
  );

  console.log(
    "Remote Smoke Summary",
  );

  console.log(
    "=====================================",
  );


  if (
    failureCount === 0
  ) {
    printSuccess(
      "REMOTE SMOKE PASSED",
    );

    console.log(
      `Warnings: ${warningCount}`,
    );

    console.log(
      "No remote data was modified.",
    );

    console.log("");

    console.log(
      "Recommended next check:",
    );

    console.log(
      "  npm run test:contracts",
    );

    return;
  }


  printFailure(
    "REMOTE SMOKE FAILED",
  );

  console.error(
    `Failures: ${failureCount}`,
  );

  console.error(
    `Warnings: ${warningCount}`,
  );

  console.error(
    "No remote data was modified.",
  );


  /*
   * Do not use process.exit().
   *
   * On Node 24 + Windows an immediate process.exit()
   * after fetch can trigger libuv:
   *
   * UV_HANDLE_CLOSING
   *
   * Setting exitCode allows Node to shut down normally.
   */
  process.exitCode = 1;
};


await main();