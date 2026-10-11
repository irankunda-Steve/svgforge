import process from 'node:process';
import {createLogger} from '../../../lib/svgforge/utils/logger.js';
import {
  afterEach,
  describe,
  expect,
  it,
  restoreAllMocks,
  spyOn,
} from '../../helpers/harness.js';

describe('testing createLogger()', () => {
  let stdoutWriteSpy;

  afterEach(() => {
    restoreAllMocks();
  });

  const spyStdout = () => {
    stdoutWriteSpy = spyOn(process.stdout, 'write').mockImplementation(() => true);
  };

  it('should write messages at or above the configured level to stdout', () => {
    expect.hasAssertions();

    spyStdout();
    const logger = createLogger({level: 'info'});

    logger.info('Hello %s', 'world');
    logger.debug('hidden');

    expect(stdoutWriteSpy).toHaveBeenCalledTimes(1);
    expect(stdoutWriteSpy.mock.calls[0][0]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} - info: Hello world\n$/u);
  });

  it('should write error and warn messages', () => {
    expect.hasAssertions();

    spyStdout();
    const logger = createLogger({level: 'debug'});

    logger.error('boom');
    logger.warn('careful');
    logger.debug('detail');
    logger.verbose('verbose message');

    expect(stdoutWriteSpy).toHaveBeenCalledTimes(4);
  });

  it('should expose a winston-compatible surface', () => {
    expect.hasAssertions();

    const logger = createLogger({level: 'verbose'});

    expect(logger.level).toBe('verbose');
    expect(logger.transports).toHaveLength(1);
    expect(logger.transports[0].level).toBe('verbose');
    expect(logger.log).toBeInstanceOf(Function);
    expect(logger.info).toBeInstanceOf(Function);
  });

  it('should not write anything when silent', () => {
    expect.hasAssertions();

    spyStdout();
    const logger = createLogger({level: 'debug', silent: true});

    logger.info('not shown');
    logger.error('not shown');

    expect(stdoutWriteSpy).not.toHaveBeenCalled();
  });

  it('should route explicit log() calls through emit', () => {
    expect.hasAssertions();

    spyStdout();
    const logger = createLogger({level: 'warn'});

    logger.log('warn', 'careful');
    logger.log('info', 'hidden below warn');

    expect(stdoutWriteSpy).toHaveBeenCalledTimes(1);
  });
});
