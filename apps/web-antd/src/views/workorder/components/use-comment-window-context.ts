import { onBeforeUnmount, onDeactivated, watch } from 'vue';

import {
  createRequestOwnerScope,
  type RequestOwnerContext,
} from '@vben/request';
import { useAccessStore, useUserStore } from '@vben/stores';

import { useAuthStore } from '#/store';

export interface CommentWindowTicket {
  instanceId: number;
  generation: number;
  owner: RequestOwnerContext;
}

/** Comment windows add instance/lifetime ownership to the existing request owner boundary. */
export function useCommentWindowContext(reset: () => void) {
  const user = useUserStore();
  const access = useAccessStore();
  const auth = useAuthStore();
  const ownerScope = createRequestOwnerScope(() => {
    const uid = user.userInfo?.userId || '';
    const generation = auth.getAuthGeneration();
    const authenticated = !!access.accessToken;
    return { authenticated, generation, uid };
  });
  let disposed = false;
  function createWindow() {
    let generation = 0;
    return {
      current(ticket: CommentWindowTicket | undefined) {
        if (disposed || !ticket || ticket.generation !== generation)
          return false;
        try {
          ownerScope.assert(ticket.owner);
          return true;
        } catch {
          return false;
        }
      },
      invalidate() {
        generation += 1;
      },
      open(instanceId: number): CommentWindowTicket | undefined {
        generation += 1;
        const owner = ownerScope.capture();
        if (
          disposed ||
          !Number.isSafeInteger(instanceId) ||
          instanceId <= 0 ||
          !owner.authenticated ||
          !owner.uid
        )
          return;
        return { generation, instanceId, owner };
      },
    };
  }
  const view = createWindow();
  const form = createWindow();
  function invalidate() {
    view.invalidate();
    form.invalidate();
    reset();
  }
  watch(
    [
      () => user.userInfo?.userId,
      () => auth.getAuthGeneration(),
      () => !!access.accessToken,
    ],
    invalidate,
    { flush: 'sync' },
  );
  onDeactivated(invalidate);
  onBeforeUnmount(() => {
    disposed = true;
    invalidate();
  });
  return { form, view };
}
