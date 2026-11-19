import { defineComponent, h } from 'vue';

import {
  Icon as IconifyIcon,
  type IconifyIcon as IconifyIconData,
} from '@iconify/vue/offline';
import { Disc } from 'lucide-vue-next';

import { hasOfflineIcon } from './register';

export const Icon = defineComponent({
  inheritAttrs: false,
  name: 'Icon',
  props: {
    icon: {
      required: true,
      type: [Object, String],
    },
  },
  setup(props, { attrs }) {
    return () => {
      const icon = props.icon;
      if (typeof icon === 'string' && !hasOfflineIcon(icon)) {
        return h(Disc, {
          ...attrs,
          'data-offline-fallback': 'true',
        });
      }
      return h(IconifyIcon, {
        ...attrs,
        icon: icon as IconifyIconData | string,
      });
    };
  },
});
