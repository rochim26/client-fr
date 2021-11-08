import axios from "axios";
import parser from "fast-xml-parser";
import { camelizeKeys } from "humps";

export default async function handler(req, res) {
  const { url, method, headers, responseType, data } = req.body;
  // return res.status(200).json({ url, method, headers, responseType, data });
  await axios({ url, method, headers, responseType, data })
    .then((response) => {
      let converted = response.data;
      if (!responseType) {
        converted = parser.parse(response?.data);
      } else if (responseType == "arraybuffer") {
        converted = Buffer.from(response.data, "binary").toString("base64");
      }
      return res.status(200).json({
        isSuccess: true,
        error: false,
        data: converted,
        status: response.status,
      });
    })
    .catch((err) => {
      let error = err?.response?.data;
      error = camelizeKeys(error);

      return res.status(200).json({
        isSuccess: false,
        data: err?.data,
        error,
        status: err?.response?.status,
      });
    });
}
