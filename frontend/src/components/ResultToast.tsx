import "./ResultToast.css";

interface ResultToastProps {
  eligible: boolean;
  findings: string[];
}

export function ResultToast({ eligible, findings }: ResultToastProps) {
  return (
    <div className={`toast-box ${eligible ? "toast-success" : "toast-danger"}`}>
      <div className="toast-body">
        <div className="toast-header">
          <i className={`bi ${eligible ? "bi-emoji-smile" : "bi-emoji-frown"} toast-icon`} aria-hidden="true" />
          <span className="toast-headline">{eligible ? "Success!" : "Unable!"}</span>
        </div>
        {eligible ? (
          <p>
            You are eligible to be part of the Specialists of ATC program. Click below to
            submit your application.
          </p>
        ) : (
          <>
            <p>
              You aren&apos;t currently eligible for the Specialists of ATC program due to
              the following findings. You are welcome to apply again once you are eligible.
            </p>
            <ol>
              {findings.map((finding) => (
                <li key={finding}>{finding}</li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
