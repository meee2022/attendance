/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assessmentPlan from "../assessmentPlan.js";
import type * as assessments from "../assessments.js";
import type * as attendance from "../attendance.js";
import type * as classHelpers from "../classHelpers.js";
import type * as diagnostics from "../diagnostics.js";
import type * as followUp from "../followUp.js";
import type * as grades from "../grades.js";
import type * as messages from "../messages.js";
import type * as platformAccess from "../platformAccess.js";
import type * as practicalExams from "../practicalExams.js";
import type * as scoreImports from "../scoreImports.js";
import type * as settings from "../settings.js";
import type * as setup from "../setup.js";
import type * as students from "../students.js";
import type * as supervision from "../supervision.js";
import type * as supervisionAccess from "../supervisionAccess.js";
import type * as supervisionAcknowledgements from "../supervisionAcknowledgements.js";
import type * as supervisionActions from "../supervisionActions.js";
import type * as supervisionDefaults from "../supervisionDefaults.js";
import type * as supervisionSessions from "../supervisionSessions.js";
import type * as surveys from "../surveys.js";
import type * as teacherTasks from "../teacherTasks.js";
import type * as visitArchiveMaintenance from "../visitArchiveMaintenance.js";
import type * as visitCriteria from "../visitCriteria.js";
import type * as visitImports from "../visitImports.js";
import type * as visitMath from "../visitMath.js";
import type * as visitWorkflow from "../visitWorkflow.js";
import type * as visits from "../visits.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  assessmentPlan: typeof assessmentPlan;
  assessments: typeof assessments;
  attendance: typeof attendance;
  classHelpers: typeof classHelpers;
  diagnostics: typeof diagnostics;
  followUp: typeof followUp;
  grades: typeof grades;
  messages: typeof messages;
  platformAccess: typeof platformAccess;
  practicalExams: typeof practicalExams;
  scoreImports: typeof scoreImports;
  settings: typeof settings;
  setup: typeof setup;
  students: typeof students;
  supervision: typeof supervision;
  supervisionAccess: typeof supervisionAccess;
  supervisionAcknowledgements: typeof supervisionAcknowledgements;
  supervisionActions: typeof supervisionActions;
  supervisionDefaults: typeof supervisionDefaults;
  supervisionSessions: typeof supervisionSessions;
  surveys: typeof surveys;
  teacherTasks: typeof teacherTasks;
  visitArchiveMaintenance: typeof visitArchiveMaintenance;
  visitCriteria: typeof visitCriteria;
  visitImports: typeof visitImports;
  visitMath: typeof visitMath;
  visitWorkflow: typeof visitWorkflow;
  visits: typeof visits;
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
