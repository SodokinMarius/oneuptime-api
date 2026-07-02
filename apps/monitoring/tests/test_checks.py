"""Tests for extended monitor check types."""
from unittest.mock import MagicMock, patch

import pytest

from apps.monitoring.models import CheckStatus, Monitor
from apps.monitoring.services.checks import run_check


@pytest.fixture
def base_monitor(db):
    return Monitor(
        name="test",
        type="api",
        url="https://example.com",
        timeout_seconds=5,
        interval_seconds=60,
        retries=3,
        criteria={},
        steps=[],
    )


@pytest.mark.django_db
class TestDnsCheck:
    def test_dns_a_record_success(self, base_monitor):
        base_monitor.type = "dns"
        base_monitor.url = "example.com"
        base_monitor.criteria = {"record_type": "A"}
        with patch("socket.getaddrinfo", return_value=[(None, None, None, None, ("93.184.216.34", 0))]):
            status, _, _, error = run_check(base_monitor)
        assert status == CheckStatus.SUCCESS
        assert error == ""

    def test_dns_expected_value_mismatch(self, base_monitor):
        base_monitor.type = "dns"
        base_monitor.url = "example.com"
        base_monitor.criteria = {"record_type": "A", "expected_values": ["1.2.3.4"]}
        with patch("socket.getaddrinfo", return_value=[(None, None, None, None, ("93.184.216.34", 0))]):
            status, _, _, error = run_check(base_monitor)
        assert status == CheckStatus.FAILURE
        assert "Expected" in error


@pytest.mark.django_db
class TestSslCheck:
    def test_ssl_certificate_valid(self, base_monitor):
        base_monitor.type = "ssl"
        base_monitor.url = "example.com"
        fake_cert = {"notAfter": "Dec 31 23:59:59 2099 GMT", "subjectAltName": [("DNS", "example.com")]}
        mock_sock = MagicMock()
        with patch("socket.create_connection", return_value=mock_sock):
            with patch("ssl.create_default_context") as ctx:
                secure = MagicMock()
                secure.__enter__.return_value = secure
                secure.getpeercert.return_value = fake_cert
                ctx.return_value.wrap_socket.return_value = secure
                status, _, _, error = run_check(base_monitor)
        assert status == CheckStatus.SUCCESS
        assert error == ""


@pytest.mark.django_db
class TestMultiStepCheck:
    def test_multi_step_requires_steps(self, base_monitor):
        base_monitor.type = "multi_step_api"
        base_monitor.steps = []
        status, _, _, error = run_check(base_monitor)
        assert status == CheckStatus.ERROR
        assert "step" in error.lower()

    def test_multi_step_success(self, base_monitor):
        base_monitor.type = "multi_step_api"
        base_monitor.steps = [
            {
                "method": "GET",
                "url": "https://example.com/health",
                "assert": {"status": 200},
            }
        ]
        response = MagicMock(status_code=200, text='{"ok": true}')
        with patch("requests.request", return_value=response):
            status, code, _, error = run_check(base_monitor)
        assert status == CheckStatus.SUCCESS
        assert code == 200
        assert error == ""


@pytest.mark.django_db
class TestUdpCheck:
    def test_udp_send_success_without_response(self, base_monitor):
        base_monitor.type = "udp"
        base_monitor.url = "127.0.0.1:9999"
        base_monitor.criteria = {"expect_response": False}
        mock_sock = MagicMock()
        with patch("socket.socket", return_value=mock_sock):
            status, _, _, error = run_check(base_monitor)
        assert status == CheckStatus.SUCCESS
        assert error == ""
        mock_sock.sendto.assert_called_once()

    def test_udp_timeout_when_response_expected(self, base_monitor):
        import socket as socket_module

        base_monitor.type = "udp"
        base_monitor.url = "127.0.0.1:9999"
        base_monitor.criteria = {"expect_response": True}
        mock_sock = MagicMock()
        mock_sock.recvfrom.side_effect = socket_module.timeout("timed out")
        with patch("socket.socket", return_value=mock_sock):
            status, _, _, error = run_check(base_monitor)
        assert status == CheckStatus.TIMEOUT
        assert "No UDP response" in error


@pytest.mark.django_db
class TestPingCheck:
    def test_ping_success(self, base_monitor):
        base_monitor.type = "ping"
        base_monitor.url = "example.com"
        proc = MagicMock(returncode=0, stdout="64 bytes from example.com", stderr="")
        with patch("subprocess.run", return_value=proc):
            status, _, _, error = run_check(base_monitor)
        assert status == CheckStatus.SUCCESS
        assert error == ""

    def test_ping_failure(self, base_monitor):
        base_monitor.type = "ping"
        base_monitor.url = "example.com"
        proc = MagicMock(returncode=1, stdout="", stderr="Host unreachable")
        with patch("subprocess.run", return_value=proc):
            status, _, _, error = run_check(base_monitor)
        assert status == CheckStatus.FAILURE
        assert "unreachable" in error.lower() or error


@pytest.mark.django_db
class TestJourneyCheck:
    def test_journey_runs_steps_with_think_time(self, base_monitor):
        base_monitor.type = "journey"
        base_monitor.criteria = {"think_time_ms": 0}
        base_monitor.steps = [
            {"method": "GET", "url": "https://example.com/login", "assert": {"status": 200}},
            {"method": "GET", "url": "https://example.com/dashboard", "assert": {"status": 200}},
        ]
        response = MagicMock(status_code=200, text="ok")
        with patch("requests.request", return_value=response) as mock_request:
            status, _, _, error = run_check(base_monitor)
        assert status == CheckStatus.SUCCESS
        assert error == ""
        assert mock_request.call_count == 2
