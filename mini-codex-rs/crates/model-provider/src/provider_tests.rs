use super::*;
#[test]
fn configured_provider_selects_remote_compaction_independently_of_model() {
    let mut info = ModelProviderInfo::create_deepseek_provider();
    assert_eq!(
        ConfiguredModelProvider::new(info.clone())
            .capabilities()
            .remote_compaction,
        RemoteCompactionSupport::Unsupported
    );
    info.name = "OpenAI".into();
    info.base_url = Some("http://localhost/proxy".into());
    assert_eq!(
        ConfiguredModelProvider::new(info.clone())
            .capabilities()
            .remote_compaction,
        RemoteCompactionSupport::V2
    );
    info.name = "Azure".into();
    assert_eq!(
        ConfiguredModelProvider::new(info.clone())
            .capabilities()
            .remote_compaction,
        RemoteCompactionSupport::V2
    );
    info.name = "Proxy".into();
    info.base_url = Some("https://test.openai.azure.com/openai".into());
    assert_eq!(
        ConfiguredModelProvider::new(info)
            .capabilities()
            .remote_compaction,
        RemoteCompactionSupport::V2
    );
}
