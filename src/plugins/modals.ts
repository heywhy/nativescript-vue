import { Application, ShowModalOptions, View } from '@nativescript/core';
import {
  App,
  Component,
  ComponentPublicInstance,
  InjectionKey,
  Ref,
  inject,
  unref,
  warn,
} from '@vue/runtime-core';
import { NSVElement, NSVRoot } from '../dom';
import { createNativeView } from '../runtimeHelpers';
import { isObject } from '@vue/shared';

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    /**
     * todo: update docblock
     */
    $showModal: <T = any>(
      component: Component,
      options?: ModalOptions
    ) => Promise<T | false | undefined>;
  }
}

type ResolvableModalTarget = ComponentPublicInstance | NSVElement | View;

export interface ModalOptions extends Partial<ShowModalOptions> {
  props?: Record<string, any>;
  target?: ResolvableModalTarget;
}

/**
 * @internal
 */
export function install(app: App) {
  app.config.globalProperties.$showModal = $showModal;
}

export const useModal = () => ({
  showModal: $showModal,
  current: inject(MODAL),
});

function resolveModalTarget(
  target: Ref<ResolvableModalTarget> | ResolvableModalTarget
): View | undefined {
  const ob = unref<ResolvableModalTarget>(target);

  if (ob instanceof NSVElement) {
    return ob.nativeView;
  } else if (ob instanceof View) {
    return ob;
  } else if (isObject(ob) && isObject(ob.$el)) {
    return ob.$el.nativeView;
  }
}

type Modal = { close: (...args: any[]) => void };

const MODAL: InjectionKey<Modal | undefined> = Symbol('ns:modal');

export async function $showModal<T = any>(
  component: Component,
  options: ModalOptions = {}
): Promise<T | false | undefined> {
  const modalTarget = resolveModalTarget(
    options.target ?? Application.getRootView()
  );

  if (!modalTarget) {
    if (__DEV__) {
      warn(`could not open modal because the target does not exist`);
    }
    return;
  }

  return new Promise((resolve) => {
    let isResolved = false;
    let isReloading = false;
    let root = new NSVRoot();

    const reloadModal = () => {
      isReloading = true;
      closeModal();
      // reopening is done in `closeCallback`
    };

    let view = createNativeView(component, options.props, {
      reload: reloadModal,
    });

    const closeCallback = (data?: T) => {
      if (isResolved) return;

      if (isReloading) {
        view.unmount();
        view.mount(root);
        openModal({
          // todo: for this to work nicely, we'd need to add `animated: false` to `closeModal` as well
          // but not currently possible without a core change.
          // animated: false,
        });
        isReloading = false;

        return;
      }

      isResolved = true;
      view.unmount();
      view = null;

      resolve(data);
    };

    const openModal = (additionalOptions?: Partial<ShowModalOptions>) => {
      modalTarget.showModal(view.nativeView, {
        ...options,
        context: null,
        closeCallback,
        ...additionalOptions,
      });
    };

    const closeModal = (...args: any[]) => view.nativeView?.closeModal(...args);

    view.context.provides[MODAL as any] = {
      close: closeModal,
    };

    view.mount(root);
    openModal();
  });
}
