import axios from "axios";
import { camelizeKeys } from "humps";

const client = (endpoint, { body, method, headers, params } = {}) => {
  headers = {
    ...headers,
    "content-type": "application/json",
    accept: "application/json",
  };

  const config = {
    url: `http://localhost:8000/${endpoint}`,
    headers: {
      ...headers,
    },
    method: method || "GET",
  };

  if (params) {
    config.params = params;
  }

  if (body) {
    config.data = body;
  }

  const onSuccess = (res) => {
    let data = res?.data || null;
    data = camelizeKeys(data);

    return {
      isSuccess: true,
      error: false,
      data,
      status: res?.status,
    };
  };

  const onError = (err) => {
    let error = err?.response?.data;
    error = camelizeKeys(error);

    return {
      isSuccess: false,
      data: err?.data,
      error,
      status: err?.response?.status,
    };
  };

  return axios(config).then(onSuccess).catch(onError);
};

export const sendMessage = (payload) => {
  return client("send-message", {
    method: "POST",
    body: payload,
  });
};
