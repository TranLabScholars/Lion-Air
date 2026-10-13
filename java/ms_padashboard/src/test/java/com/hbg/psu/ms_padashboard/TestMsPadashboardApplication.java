package com.hbg.psu.ms_padashboard;

import org.springframework.boot.SpringApplication;

public class TestMsPadashboardApplication {

	public static void main(String[] args) {
		SpringApplication.from(MsPadashboardApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
