class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.audioData = [];
        this.chunkSizeSamples = 4800; // 300ms at 16kHz
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        
        if (input.length > 0) {
            const inputData = input[0]; // First channel
            
            // Accumulate audio data
            this.audioData.push(...inputData);
            
            // Check if we have enough data to send
            if (this.audioData.length >= this.chunkSizeSamples) {
                // Send the chunk to the main thread
                const audioChunk = new Float32Array(this.audioData.slice(0, this.chunkSizeSamples));
                this.port.postMessage({
                    type: 'audioData',
                    data: audioChunk
                });
                
                // Remove the sent data
                this.audioData = this.audioData.slice(this.chunkSizeSamples);
            }
        }
        
        // Keep the processor alive
        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor); 