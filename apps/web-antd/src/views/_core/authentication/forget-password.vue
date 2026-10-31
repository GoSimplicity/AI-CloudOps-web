<script lang="ts" setup>
import { ref } from 'vue';

import { AuthenticationForgetPassword } from '@vben/common-ui';
import { LOGIN_PATH } from '@vben/constants';

defineOptions({ name: 'ForgetPassword' });

const loading = ref(false);

function handleSubmit(value: string) {
  void value;
}
</script>

<template>
  <AuthenticationForgetPassword
    :loading="loading"
    :login-path="LOGIN_PATH"
    @submit="handleSubmit"
  />
</template>
