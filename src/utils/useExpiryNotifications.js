import { useEffect, useRef } from 'react';
import { useNotifications } from '../Auth/notificationContext';

export const useExpiryNotifications = ({
  successMessage,
  errorMessage,
  infoMessage,
  successDuration = 3000,
  errorDuration = 3500,
  infoDuration = 2500,
}) => {
  const { notifySuccess, notifyError, notifyInfo } = useNotifications();
  const lastValuesRef = useRef({
    successMessage: null,
    errorMessage: null,
    infoMessage: null,
  });

  useEffect(() => {
    if (successMessage && lastValuesRef.current.successMessage !== successMessage) {
      notifySuccess(successMessage, successDuration);
    }
    lastValuesRef.current.successMessage = successMessage;
  }, [successMessage, successDuration, notifySuccess]);

  useEffect(() => {
    if (errorMessage && lastValuesRef.current.errorMessage !== errorMessage) {
      notifyError(errorMessage, errorDuration);
    }
    lastValuesRef.current.errorMessage = errorMessage;
  }, [errorMessage, errorDuration, notifyError]);

  useEffect(() => {
    if (infoMessage && lastValuesRef.current.infoMessage !== infoMessage) {
      notifyInfo(infoMessage, infoDuration);
    }
    lastValuesRef.current.infoMessage = infoMessage;
  }, [infoMessage, infoDuration, notifyInfo]);
};

