export declare class MessageBuffer<M> {
    private readonly buffer;
    private readonly timeoutRefs;
    private readonly timeoutInMs;
    private readonly maxSize;
    private readonly onTimeout;
    constructor(timeoutInMs: number, maxSize?: number, onTimeout?: (id: string) => void);
    put(id: string, message: M): void;
    pop(id: string): M | null;
    popAll(id: string): Array<M>;
    clear(): void;
    size(): number;
}
