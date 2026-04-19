/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { DefaultEventsMap, EventsMap } from "@socket.io/component-emitter";
import { Socket } from "socket.io-client";

// Keep a conservative overall send rate and smooth bursts so the server
// doesn't see many messages landing in the same instant.
const NUM_MESSAGES = 8;
const TIME_INTERVAL = 1000;
const MIN_SEND_INTERVAL = Math.ceil(TIME_INTERVAL / NUM_MESSAGES);

/**
 * Wraps a socket.io socket to buffer messages, avoiding sending too many too quickly
 * so we don't get ratelimited.
 */
export class SocketWrapper<
    ListenEvents extends EventsMap = DefaultEventsMap,
    EmitEvents extends EventsMap = ListenEvents,
> {
    private queue: [string, any[]][] = [];
    private lastSendTimes: number[] = [];
    private sendTimer?: NodeJS.Timeout;
    private lastSentAt = 0;

    constructor(private socket: Socket<ListenEvents, EmitEvents>) {
        for (let i = 0; i < NUM_MESSAGES; i++) {
            this.lastSendTimes.push(0);
        }
    }

    public emit(msg: string, ...args: any[]): void {
        if (!this.socket.connected) {
            console.log(`Socket not connected, dropping message ${msg}`);
            return;
        }

        this.queue.push([msg, args]);
        this.processQueue();
    }

    private processQueue = () => {
        if (this.sendTimer) return;
        if (this.queue.length === 0) return;

        const now = Date.now();
        const batchWait = Math.max(0, TIME_INTERVAL - (now - this.lastSendTimes[0]));
        const spacingWait = Math.max(0, MIN_SEND_INTERVAL - (now - this.lastSentAt));
        const waitFor = Math.max(batchWait, spacingWait);

        if (waitFor > 0) {
            console.log(`Throttling messages for ${waitFor}ms`);
            this.sendTimer = setTimeout(this.onSendTimer, waitFor);
            return;
        }

        this.sendTail();
        if (this.queue.length > 0) this.processQueue();
    };

    private onSendTimer = () => {
        this.sendTimer = undefined;
        this.processQueue();
    };

    private sendTail(): void {
        if (this.queue.length === 0) return;

        const args = this.queue.shift()!;
        this.lastSendTimes.shift();
        this.lastSentAt = Date.now();
        this.lastSendTimes.push(this.lastSentAt);

        this.socket.emit(
            args[0],
            ...(args[1] as Parameters<EmitEvents[string]>),
        );
    }
}
