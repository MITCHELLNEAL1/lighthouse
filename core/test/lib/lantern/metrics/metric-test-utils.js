/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {LoadSimulator} from '../../../../computed/load-simulator.js';
import {ProcessedNavigation} from '../../../../computed/processed-navigation.js';
import {ProcessedTrace} from '../../../../computed/processed-trace.js';
import {TraceEngineResult} from '../../../../computed/trace-engine-result.js';
import {PageDependencyGraph} from '../../../../lib/lantern/page-dependency-graph.js';
import * as Lantern from '../../../../lib/lantern/types/lantern.js';
import {getURLArtifactFromDevtoolsLog} from '../../../test-utils.js';

/** @typedef {Lantern.NetworkRequest<import('@paulirish/trace_engine/models/trace/types/TraceEvents.js').SyntheticNetworkRequest>} NetworkRequest */

// TODO(15841): remove usage of Lighthouse code to create test data

/**
 * @param {LH.Artifacts.URL} theURL
 * @param {LH.Trace} trace
 * @param {LH.Artifacts.ComputedContext} context
 */
async function createGraph(theURL, trace, context) {
  const {mainThreadEvents} = await ProcessedTrace.request(trace, context);
  const traceEngineResult = await TraceEngineResult.request({trace}, context);
  return PageDependencyGraph.createGraphFromTrace(
    mainThreadEvents, trace, traceEngineResult, theURL);
}

/**
 * @param {{trace: LH.Trace, devtoolsLog: LH.DevtoolsLog, settings?: LH.Config.Settings, URL?: LH.Artifacts.URL}} opts
 */
async function getComputationDataFromFixture({trace, devtoolsLog, settings, URL}) {
  // @ts-expect-error don't need all settings
  settings = settings ?? {};
  URL = URL || getURLArtifactFromDevtoolsLog(devtoolsLog);
  const gatherContext = {gatherMode: 'navigation'};
  const context = {settings, computedCache: new Map()};

  const {graph, records} = await createGraph(URL, trace, context);
  const processedNavigation = await ProcessedNavigation.request(trace, context);
  // TODO(15841): figure out why this isn't creating the same simulator as LoadSimulator.
  // const networkAnalysis = NetworkAnalyzer.analyze(records);
  // const simulator = Simulator.createSimulator({...settings, networkAnalysis});
  const data = {trace, devtoolsLog, gatherContext, settings, URL};
  // @ts-expect-error don't need all of data typed
  const simulator = await LoadSimulator.request(data, context);

  return {simulator, graph, processedNavigation};
}

export {getComputationDataFromFixture};
