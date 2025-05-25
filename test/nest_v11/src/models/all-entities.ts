import * as models from './index';

export const allEntities = Object.values(models).filter(
  (entity) =>
    typeof entity === 'function' &&
    entity.prototype &&
    entity.prototype.constructor.name,
);
