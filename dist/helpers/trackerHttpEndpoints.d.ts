import { TemplatedApp } from "uWebSockets.js";
import { MetricsContext } from "./MetricsContext";
import { Tracker } from "../logic/Tracker";
export declare function trackerHttpEndpoints(wss: TemplatedApp, tracker: Tracker, metricsContext: MetricsContext): void;
