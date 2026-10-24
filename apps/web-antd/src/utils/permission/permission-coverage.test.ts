import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  FE02_SUPPLEMENT_PERMISSION_CODES,
  PERMISSION_CODES,
  S1B_PERMISSION_CODES,
  U3_PERMISSION_CODES,
} from '#/constants/permission-codes';

/**
 * 静态核对：清单 v4 S1（主表 #1–#77）和 S1b（#84 / #85 / #87）的每个 key 都在页面源码里以 can('<key>') 门禁。
 * views/k8s/cluster/** 不在本轮可改范围（W3），集群补充码单独列出。
 */
const SRC = resolve(__dirname, '../..');
const EXCLUDED = [join(SRC, 'views/k8s/cluster')];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (
      EXCLUDED.some(
        (excluded) => path === excluded || path.startsWith(`${excluded}/`),
      )
    )
      continue;
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(vue|ts)$/.test(name) && !/\.test\.ts$/.test(name))
      out.push(path);
  }
  return out;
}

const sources = walk(SRC).map((path) => ({
  path: relative(SRC, path),
  text: readFileSync(path, 'utf8'),
}));

function gatedIn(key: string) {
  const pattern = new RegExp(
    String.raw`can\(\s*['"]${key.replaceAll('.', '\\.')}['"]`,
  );
  return sources
    .filter(
      ({ path, text }) =>
        !path.startsWith('utils/permission/') && pattern.test(text),
    )
    .map(({ path }) => path);
}

describe('权限码门禁覆盖（静态）', () => {
  it.each(Object.keys(PERMISSION_CODES))(
    '主表 %s 在页面里有 can() 门禁',
    (key) => {
      expect(gatedIn(key).length).toBeGreaterThan(0);
    },
  );

  it.each([
    ['k8s.node.cordon', 'views/k8s/node/Node.vue'],
    ['k8s.node.uncordon', 'views/k8s/node/Node.vue'],
    ['k8s.node.batchCordon', 'views/k8s/node/Node.vue'],
  ])('S1b %s 已接到按钮（清单 v4：始终按码判断）', (key, file) => {
    expect(key in S1B_PERMISSION_CODES).toBe(true);
    expect(key in U3_PERMISSION_CODES).toBe(false);
    expect(gatedIn(key)).toContain(file);
  });

  it('S1b 三个 key 就是上面逐个核对的三个', () => {
    expect(Object.keys(S1B_PERMISSION_CODES).sort()).toEqual([
      'k8s.node.batchCordon',
      'k8s.node.cordon',
      'k8s.node.uncordon',
    ]);
  });

  it('本轮未接的码如实列出：S3（U3 范围待批）与 S2 集群补充码（views/k8s/cluster 不改）', () => {
    const notWired = [
      ...Object.keys(S1B_PERMISSION_CODES),
      ...Object.keys(U3_PERMISSION_CODES),
      ...Object.keys(FE02_SUPPLEMENT_PERMISSION_CODES),
    ].filter((key) => gatedIn(key).length === 0);
    expect(notWired.sort()).toMatchInlineSnapshot(`
      [
        "aiops.assistant.uploadKnowledge",
        "cron.job.batchDisable",
        "cron.job.batchEnable",
        "cron.job.disable",
        "cron.job.enable",
        "k8s.cluster.batchDelete",
        "k8s.cluster.delete",
        "k8s.cluster.kubeconfigCopy",
        "k8s.cluster.kubeconfigDownload",
        "k8s.daemonset.batchRestart",
        "k8s.daemonset.restart",
        "k8s.deployment.batchRestart",
        "k8s.deployment.restart",
        "k8s.node.drain",
        "k8s.pod.fileDownload",
        "k8s.pod.fileUpload",
        "k8s.pod.portForward",
        "k8s.statefulset.batchRestart",
        "k8s.statefulset.restart",
        "system.role.revokeApi",
        "system.user.revokeRole",
        "workorder.notification.manualSend",
        "workorder.notification.testSend",
      ]
    `);
  });
});
