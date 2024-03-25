/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {makeComputedArtifact} from '../computed-artifact.js';
import {LanternMetric} from './lantern-metric.js';
import {BaseNode} from '../../lib/lantern/base-node.js';
import {LanternFirstContentfulPaint} from './lantern-first-contentful-paint.js';
import {LanternInteractive} from './lantern-interactive.js';
import {BLOCKING_TIME_THRESHOLD, calculateSumOfBlockingTime} from './tbt-utils.js';

/** @typedef {import('../../lib/lantern/base-node.js').Node<LH.Artifacts.NetworkRequest>} Node */

class LanternTotalBlockingTime extends LanternMetric {
  /**
   * @return {LH.Gatherer.Simulation.MetricCoefficients}
   */
  static get COEFFICIENTS() {
    return {
      intercept: 0,
      optimistic: 0.5,
      pessimistic: 0.5,
    };
  }

  /**
   * @param {Node} dependencyGraph
   * @return {Node}
   */
  static getOptimisticGraph(dependencyGraph) {
    return dependencyGraph;
  }

  /**
   * @param {Node} dependencyGraph
   * @return {Node}
   */
  static getPessimisticGraph(dependencyGraph) {
    return dependencyGraph;
  }

  /**
   * @param {LH.Gatherer.Simulation.Result} simulation
   * @param {import('../../lib/lantern/metric.js').Extras} extras
   * @return {LH.Gatherer.Simulation.Result}
   */
  static getEstimateFromSimulation(simulation, extras) {
    if (!extras.fcpResult) throw new Error('missing fcpResult');
    if (!extras.interactiveResult) throw new Error('missing interactiveResult');

    // Intentionally use the opposite FCP estimate. A pessimistic FCP is higher than equal to an
    // optimistic FCP, which means potentially more tasks are excluded from the Total Blocking Time
    // computation. So a more pessimistic FCP gives a more optimistic Total Blocking Time for the
    // same work.
    const fcpTimeInMs = extras.optimistic
      ? extras.fcpResult.pessimisticEstimate.timeInMs
      : extras.fcpResult.optimisticEstimate.timeInMs;

    // Similarly, we always have pessimistic TTI >= optimistic TTI. Therefore, picking optimistic
    // TTI means our window of interest is smaller and thus potentially more tasks are excluded from
    // Total Blocking Time computation, yielding a lower (more optimistic) Total Blocking Time value
    // for the same work.
    const interactiveTimeMs = extras.optimistic
      ? extras.interactiveResult.optimisticEstimate.timeInMs
      : extras.interactiveResult.pessimisticEstimate.timeInMs;

    const minDurationMs = BLOCKING_TIME_THRESHOLD;

    const events = LanternTotalBlockingTime.getTopLevelEvents(
      simulation.nodeTimings,
      minDurationMs
    );

    return {
      timeInMs: calculateSumOfBlockingTime(
        events,
        fcpTimeInMs,
        interactiveTimeMs
      ),
      nodeTimings: simulation.nodeTimings,
    };
  }

  /**
   * @param {LH.Artifacts.MetricComputationDataInput} data
   * @param {LH.Artifacts.ComputedContext} context
   * @return {Promise<LH.Artifacts.LanternMetric>}
   */
  static async compute_(data, context) {
    const fcpResult = await LanternFirstContentfulPaint.request(data, context);
    const interactiveResult = await LanternInteractive.request(data, context);
    return this.computeMetricWithGraphs(data, context, {fcpResult, interactiveResult});
  }

  /**
   * @param {LH.Gatherer.Simulation.Result['nodeTimings']} nodeTimings
   * @param {number} minDurationMs
   */
  static getTopLevelEvents(nodeTimings, minDurationMs) {
    /** @type {Array<{start: number, end: number, duration: number}>}
     */
    const events = [];

    for (const [node, timing] of nodeTimings.entries()) {
      if (node.type !== BaseNode.TYPES.CPU) continue;
      // Filtering out events below minimum duration.
      if (timing.duration < minDurationMs) continue;

      events.push({
        start: timing.startTime,
        end: timing.endTime,
        duration: timing.duration,
      });
    }

    return events;
  }
}

const LanternTotalBlockingTimeComputed = makeComputedArtifact(
  LanternTotalBlockingTime,
  ['devtoolsLog', 'gatherContext', 'settings', 'simulator', 'trace', 'URL']
);
export {LanternTotalBlockingTimeComputed as LanternTotalBlockingTime};