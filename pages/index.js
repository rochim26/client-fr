import axios from "axios";
import moment from "moment";
import React, { useEffect, useState } from "react";
import { getCameras, putCameras } from "../client/CameraClient";
import { getBelumSinkron, getLogData, getLogPhoto } from "../client/FRClient";
import Layout from "../components/Layout/Layout";
import { useRouter } from "next/router";
import {
  postProfilesListen,
  getProfilesSession,
} from "../client/ProfileClient";
import Link from "next/link";
import { postAttendances } from "../client/AttendancesClient";
import { postAbsenFr } from "../client/AbsenClient";
import { sendMessage } from "../client/WhatsAppClient";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const index = () => {
  const [belumSinkron, setBelumSinkron] = useState([]);

  const router = useRouter();

  const _postProfilesListen = async (payload) => {
    const { data, status, error } = await postProfilesListen(payload);

    if (status == 404) {
      toast.error(error.message);
      router.push("/install");
    }
  };

  const [profileSessionState, setProfileSessionState] = useState({});
  const [sessionLoading, setSessionLoading] = useState(true);

  const _getProfilesSession = async () => {
    const { data, status, error } = await getProfilesSession();

    if (status == 404) {
      toast.error(error.message);
      router.push("/install");

      return;
    }

    if (data) {
      const { profile } = data;

      setSessionLoading(false);

      setProfileSessionState(profile);
    }
  };

  const _getDataBelumSinkron = async (cam) => {
    const { data, error } = await getBelumSinkron(cam);

    if (data) {
      setBelumSinkron([
        ...belumSinkron.filter((item) => item.id != cam.id),
        {
          ...cam,
          jumlah: data.data?.FaceRecognition?.RecognitionRecordCount,
        },
      ]);

      if (data.data?.FaceRecognition?.RecognitionRecordCount > 0) {
        _getLogData(cam, data.data?.FaceRecognition?.RecognitionRecordCount);
      }
    }
  };

  const _getLogData = async (cam, totalBelumSinkron) => {
    if (totalBelumSinkron == 0 || !profileSessionState?.schoolUrl) {
      return;
    }

    const { data, error } = await getLogData(cam, totalBelumSinkron);

    if (data) {
      let faceData = data?.data?.RecognitionRecordList?.RecognitionRecord;

      if (faceData.length > 0) {
        await Promise.all(
          faceData?.map(async (d, idx) => {
            const { data: photoIn } = await getLogPhoto(cam, d);

            // smksiswa16

            if (photoIn) {
              const nameArray = d?.PeopleName?.split("-");

              const payload = {
                photo: photoIn?.data,
                mask: d?.FaceMask == "no" ? 0 : 1,
                temp: d?.FaceTemperature?.Temperature?.toFixed(2),
                whatsapp: nameArray?.[0],
                groupClass: nameArray?.[1],
                name: nameArray?.[2],
                similar: d?.Similar,
                checkTime: moment(d?.Time).format("YYYY-MM-DD HH:mm:ss"),
                ipCamera: cam?.ipCamera,
                camId: cam?.id,
                domain: profileSessionState?.schoolUrl,
              };

              const { data: dataUser } = await postAbsenFr({
                photo: payload.photo,
                mask: payload.mask,
                temp: payload.temp,
                whatsapp: payload.whatsapp,
                domain: payload.domain,
              });

              if (dataUser) {
                const { user } = dataUser;

                await postAttendances({
                  ...payload,
                  ibu: user?.profil?.telpIbu,
                  ayah: user?.profil?.telpAyah,
                });
              }
            }
          })
        );
      } else {
        const { data: photoIn } = await getLogPhoto(cam, faceData);

        if (photoIn) {
          const nameArray = faceData?.PeopleName?.split("-");

          const payload = {
            photo: photoIn?.data,
            mask: faceData?.FaceMask == "no" ? 0 : 1,
            temp: faceData?.FaceTemperature?.Temperature?.toFixed(2),
            whatsapp: nameArray?.[0],
            groupClass: nameArray?.[1],
            name: nameArray?.[2],
            similar: faceData?.Similar,
            checkTime: moment(faceData?.Time).format("YYYY-MM-DD HH:mm:ss"),
            ipCamera: cam?.ipCamera,
            camId: cam?.id,
            domain: profileSessionState?.schoolUrl,
          };

          const { data: dataUser } = await postAbsenFr({
            photo: payload.photo,
            mask: payload.mask,
            temp: payload.temp,
            whatsapp: payload.whatsapp,
            domain: payload.domain,
          });

          if (dataUser) {
            const { user } = dataUser;

            await postAttendances({
              ...payload,
              ibu: user?.profil?.telpIbu,
              ayah: user?.profil?.telpAyah,
            });
          }
        }
      }
    }

    // update last sync
    await putCameras(cam.id);

    return;
  };

  const [cameras, setCameras] = useState([]);
  const [cameraLoading, setCameraLoading] = useState(true);

  const _getCameras = async () => {
    const { data, error } = await getCameras();

    if (data) {
      const { camera } = data;
      setCameraLoading(false);
      setCameras(camera);
      // camera?.map((cam) => {
      //   _getDataBelumSinkron(cam);
      // });
    }
  };

  useEffect(() => {
    // _postProfilesListen();
  }, []);

  useEffect(() => {
    _getProfilesSession();
  }, []);

  const [WhatsAppStatus, setWhatsAppStatus] = useState();

  const whatsappSocket = io("ws://localhost:8000", {
    transports: ["websocket", "polling"],
  });

  whatsappSocket.on("qr", () => {
    setWhatsAppStatus(null);
  });
  whatsappSocket.on("ready", () => {
    if (!WhatsAppStatus) {
      setWhatsAppStatus(1);
      _getCameras();
    }
  });
  return (
    <Layout>
      {WhatsAppStatus ? (
        <div className="container">
          <div className="d-flex justify-content-between align-items-center">
            <h2>List Kamera</h2>
            <Link href="/add-camera">
              <a className="btn btn-primary rounded-pill">Tambah Kamera</a>
            </Link>
          </div>
          {cameraLoading ? (
            "Loading..."
          ) : (
            <table className="table-ss">
              <thead>
                <tr>
                  <th>No</th>
                  <th>IP Camera</th>
                </tr>
              </thead>
              <tbody>
                {cameras?.map((d, idx) => (
                  <tr key={idx}>
                    <td data-th="No">{idx + 1}</td>
                    <td data-th="IP Camera">{d?.ipCamera}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : sessionLoading ? (
        "Loading..."
      ) : (
        <div className="container">
          <iframe
            src="http://localhost:8000"
            frameborder="0"
            width="100%"
            height="360px"
          ></iframe>
        </div>
      )}
    </Layout>
  );
};

export default index;
