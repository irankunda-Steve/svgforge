import {parentPort} from 'node:worker_threads';
import {optimize} from 'svgo';

/**
 SVGO optimization worker entry point.

 Optimizes a single SVG payload received from the parent thread and posts the
 optimized result back over the message channel. Both the request and the
 response are plain objects, so they travel through structured clone without
 loss.
 */
parentPort.on('message', ({id, svg, config}) => {
  try {
    parentPort.postMessage({id, data: optimize(svg, config).data});
  } catch (error) {
    parentPort.postMessage({
      id,
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
  }
});
