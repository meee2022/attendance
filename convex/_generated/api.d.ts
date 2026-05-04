/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assessments from "../assessments.js";
import type * as attendance from "../attendance.js";
import type * as grades from "../grades.js";
import type * as messages from "../messages.js";
import type * as settings from "../settings.js";
import type * as setup from "../setup.js";
import type * as students from "../students.js";
import type * as supervision from "../supervision.js";
import type * as surveys from "../surveys.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  assessments: typeof assessments;
  attendance: typeof attendance;
  grades: typeof grades;
  messages: typeof messages;
  settings: typeof settings;
  setup: typeof setup;
  students: typeof students;
  supervision: typeof supervision;
  surveys: typeof surveys;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
