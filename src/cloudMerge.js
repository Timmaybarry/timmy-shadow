const missing = Symbol('missing');
const object = (v) => v !== missing && v !== null && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => a === missing || b === missing ? a === b : JSON.stringify(a) === JSON.stringify(b);
const child = (path, type, key) => [...path, `${type}:${key}`];
const pathKey = (path) => JSON.stringify(path);
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function arrayMap(value) {
  if (!Array.isArray(value)) return null;
  const result = new Map();
  for (const item of value) {
    let key;
    if (object(item) && typeof item.id === 'string') key = `id:${item.id}`;
    else if (typeof item === 'string') key = `string:${item}`;
    else return null;
    if (result.has(key)) return null;
    result.set(key, item);
  }
  return result;
}

function related(a, b) {
  return a.every((part, i) => b[i] === part) || b.every((part, i) => a[i] === part);
}

function remoteHasPcChange(metadata, path, baseRevision) {
  return Object.entries(metadata).some(([key, info]) =>
    info.role === 'pc' && info.revision > baseRevision && related(JSON.parse(key), path));
}

// Paths identify object properties and array elements by ID rather than array position.
export function changedPaths(before, after, path = []) {
  if (same(before, after)) return [];
  if (object(before) && object(after)) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap((key) =>
      changedPaths(has(before, key) ? before[key] : missing, has(after, key) ? after[key] : missing, child(path, 'o', key)));
  }
  const left = arrayMap(before);
  const right = arrayMap(after);
  if (left && right) {
    const changes = [...new Set([...left.keys(), ...right.keys()])].flatMap((key) =>
      changedPaths(left.has(key) ? left.get(key) : missing, right.has(key) ? right.get(key) : missing, child(path, 'a', key)));
    if (!same([...left.keys()].filter((key) => right.has(key)), [...right.keys()].filter((key) => left.has(key)))) {
      changes.push(child(path, 'order', ''));
    }
    return changes;
  }
  return [path];
}

export function mergeCloudData(base, local, remote, { role, metadata, baseRevision }) {
  let conflicts = 0;
  function merge(b, l, r, path) {
    if (same(l, b)) return r;
    if (same(r, b) || same(l, r)) return l;
    if (object(l) && object(r) && (object(b) || b === missing)) {
      const baseObject = object(b) ? b : {};
      const result = {};
      for (const key of new Set([...Object.keys(baseObject), ...Object.keys(l), ...Object.keys(r)])) {
        const value = merge(has(baseObject, key) ? baseObject[key] : missing, has(l, key) ? l[key] : missing,
          has(r, key) ? r[key] : missing, child(path, 'o', key));
        if (value !== missing) result[key] = value;
      }
      return result;
    }
    const bm = arrayMap(b === missing ? [] : b);
    const lm = arrayMap(l);
    const rm = arrayMap(r);
    if (bm && lm && rm) {
      const result = new Map();
      for (const key of new Set([...bm.keys(), ...lm.keys(), ...rm.keys()])) {
        const value = merge(bm.has(key) ? bm.get(key) : missing, lm.has(key) ? lm.get(key) : missing,
          rm.has(key) ? rm.get(key) : missing, child(path, 'a', key));
        if (value !== missing) result.set(key, value);
      }
      const common = [...bm.keys()].filter((key) => lm.has(key) && rm.has(key));
      const localOrder = [...lm.keys()].filter((key) => common.includes(key));
      const remoteOrder = [...rm.keys()].filter((key) => common.includes(key));
      const baseOrder = common;
      let preferred = rm;
      if (same(remoteOrder, baseOrder)) preferred = lm;
      else if (!same(localOrder, baseOrder) && !same(localOrder, remoteOrder)) {
        conflicts += 1;
        if (role === 'pc' && !remoteHasPcChange(metadata, child(path, 'order', ''), baseRevision)) preferred = lm;
      }
      return [...new Set([...preferred.keys(), ...lm.keys(), ...rm.keys()])].filter((key) => result.has(key)).map((key) => result.get(key));
    }
    if (Array.isArray(l) || Array.isArray(r)) {
      throw new Error('An array with duplicate or unsupported items changed on both devices. Export both versions before resolving this conflict manually.');
    }
    conflicts += 1;
    return role === 'pc' && !remoteHasPcChange(metadata, path, baseRevision) ? l : r;
  }
  return { data: merge(base, local, remote, []), conflicts };
}

export function updateMetadata(metadata, before, after, role, revision) {
  const updated = { ...metadata };
  for (const path of changedPaths(before, after)) updated[pathKey(path)] = { role, revision };
  return updated;
}
