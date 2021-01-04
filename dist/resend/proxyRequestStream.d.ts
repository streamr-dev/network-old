/// <reference types="node" />
import { ControlLayer } from 'streamr-client-protocol';
import { Readable } from "stream";
import { ResendRequest } from "../identifiers";
export declare function proxyRequestStream(sendFn: (msg: ControlLayer.ControlMessage) => void, request: ResendRequest, requestStream: Readable): void;
