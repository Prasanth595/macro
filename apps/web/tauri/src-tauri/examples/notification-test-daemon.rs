//! Disposable notification daemon for the isolated WebKit regression runner.
//! Not part of the application; refuses to replace an existing notification service.

#[cfg(target_os = "linux")]
mod linux {
    use std::{collections::HashMap, time::Duration};
    use zbus::{object_server::SignalEmitter, zvariant::OwnedValue};

    const SERVICE: &str = "org.freedesktop.Notifications";
    const PATH: &str = "/org/freedesktop/Notifications";

    #[derive(Default)]
    struct Daemon {
        next_id: u32,
        closed: Vec<u32>,
    }

    #[zbus::interface(name = "org.freedesktop.Notifications")]
    impl Daemon {
        #[expect(clippy::too_many_arguments, reason = "freedesktop Notify signature")]
        fn notify(
            &mut self,
            _app: &str,
            replaces: u32,
            _icon: &str,
            _summary: &str,
            _body: &str,
            actions: Vec<String>,
            _hints: HashMap<String, OwnedValue>,
            _timeout: i32,
        ) -> u32 {
            assert_eq!(replaces, 0);
            assert_eq!(actions, ["default", "Open"]);
            self.next_id += 1;
            self.next_id
        }

        fn close_notification(&mut self, id: u32) {
            self.closed.push(id);
        }

        fn snapshot(&self) -> String {
            serde_json::json!({ "sent": self.next_id, "closed": self.closed }).to_string()
        }

        async fn activate(
            &self,
            id: u32,
            #[zbus(signal_emitter)] emitter: SignalEmitter<'_>,
        ) -> zbus::Result<()> {
            emitter
                .emit(SERVICE, "ActivationToken", &(id, "fixture-token"))
                .await?;
            emitter
                .emit(SERVICE, "ActionInvoked", &(id, "default"))
                .await
        }

        async fn dismiss(
            &self,
            id: u32,
            #[zbus(signal_emitter)] emitter: SignalEmitter<'_>,
        ) -> zbus::Result<()> {
            emitter
                .emit(SERVICE, "NotificationClosed", &(id, 2u32))
                .await
        }
    }

    pub async fn run() {
        let _connection = zbus::connection::Builder::session()
            .unwrap()
            .name(SERVICE)
            .unwrap()
            .serve_at(PATH, Daemon::default())
            .unwrap()
            .build()
            .await
            .unwrap();
        println!("ready");
        tokio::time::sleep(Duration::from_secs(120)).await;
    }
}

#[tokio::main]
async fn main() {
    #[cfg(target_os = "linux")]
    linux::run().await;
}
