// Copyright 2025 The Oppia Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Acceptance test from CUJv3 Doc
 * https://docs.google.com/document/d/1D7kkFTzg3rxUe3QJ_iPlnxUzBFNElmRkmAWss00nFno/
 *
 * CA. Create, edit, and delete a classroom.
 */

import {UserFactory} from '../../utilities/common/user-factory';
import testConstants from '../../utilities/common/test-constants';
import {CurriculumAdmin} from '../../utilities/user/curriculum-admin';
import {LoggedOutUser} from '../../utilities/user/logged-out-user';
import {ConsoleReporter} from '../../utilities/common/console-reporter';
import {TopicManager} from '../../utilities/user/topic-manager';
import {join} from 'path';
import {PuppeteerScreenRecorder} from 'puppeteer-screen-recorder';

const ROLES = testConstants.Roles;

ConsoleReporter.setConsoleErrorsToIgnore([/[\s\S]*/]);

describe('Curriculum Admin', function () {
  let curriculumAdmin: CurriculumAdmin & TopicManager;
  let loggedOutUser: LoggedOutUser;

  beforeAll(async function () {
    curriculumAdmin = await UserFactory.createNewUser(
      'curriculumAdm',
      'curriculum_admin@example.com',
      [ROLES.CURRICULUM_ADMIN]
    );

    loggedOutUser = await UserFactory.createLoggedOutUser();
    await curriculumAdmin.navigateToTopicAndSkillsDashboardPage();
    await curriculumAdmin.createTopic('Test Topic 1', 'test-topic-one');
    await curriculumAdmin.createSubtopicForTopic(
      'Test Subtopic 1',
      'test-subtopic-one',
      'Test Topic 1'
    );

    await curriculumAdmin.createSkillForTopic(
      'Test Skill 1',
      'Test Topic 1',
      false
    );
    await curriculumAdmin.createQuestionsForSkill('Test Skill 1', 3);
    await curriculumAdmin.assignSkillToSubtopicInTopicEditor(
      'Test Skill 1',
      'Test Subtopic 1',
      'Test Topic 1'
    );
    await curriculumAdmin.addSkillToDiagnosticTest(
      'Test Skill 1',
      'Test Topic 1'
    );

    await curriculumAdmin.publishDraftTopic('Test Topic 1');

    await curriculumAdmin.createAndPublishTopic(
      'Intro to Programming',
      'Scratch',
      'Logic Building Blocks'
    );
    await curriculumAdmin.createAndPublishTopic(
      'Intro to C Programming Language',
      'C Language',
      'Basics of C Language'
    );

    // Setup taking longer than 300000 ms.
  }, 7500000);

  it('should be able to create a new classroom', async function () {
    await curriculumAdmin.createNewClassroom('Math', 'math');
    await curriculumAdmin.expectClassroomTileToBePresent('Math');
  });

  it('should be able to edit classroom information', async function () {
    const fs = require('fs');
    const videoPath = join(__dirname, 'test_recording.mp4');
    let testPassed = false;
    const config = {
      followNewTab: false,
      fps: 25,
      ffmpeg_Path: null,
      // Below dimensions are of recorded video.
      videoFrame: {
        width: 1280,
        height: 720,
      },
      aspectRatio: '16:9',
      videoCrf: 18,
      videoCodec: 'libx264',
      videoPreset: 'medium',
      videoBitrate: 1000,
      autopad: {
        color: 'black',
      },
      waitForFrameBeforeStart: 2000,
      waitForFrameAfterPageLoad: 2000,
      maxRetries: 3, // Add retry mechanism.
      ffmpegFlags: [
        // Additional ffmpeg flags for stability.
        '-movflags',
        '+faststart',
        '-max_muxing_queue_size',
        '9999',
      ],
    };
    const screenRecorder = new PuppeteerScreenRecorder(
      curriculumAdmin.page,
      config
    );
    try {
      // 1. Start recording
      await screenRecorder.start(videoPath);

      await curriculumAdmin.updateClassroom(
        'Math',
        'Teaser text',
        'Course details',
        'Topic list intro',
        'math',
        testConstants.data.curriculumAdminThumbnailImage,
        testConstants.data.classroomBannerImage
      );
      await curriculumAdmin.expectClassroomDetailsToBe(
        'Math',
        'math',
        'Teaser text',
        'Course details',
        'Topic list intro'
      );

      // Add topics.
      await curriculumAdmin.addTopicToClassroom('Math', 'Intro to Programming');
      await curriculumAdmin.addTopicToClassroom(
        'Math',
        'Intro to C Programming Language',
        ['Intro to Programming']
      );
      await curriculumAdmin.expectTopicToContainPrerequisiteTopic(
        'Intro to C Programming Language',
        'Intro to Programming'
      );
      await curriculumAdmin.expectTopicToContainPrerequisiteTopic(
        'Intro to Programming',
        null
      );

      // If we reach here, no assertions failed
      testPassed = true;
    } catch (error) {
      // Test failed - we do nothing here so the 'finally' block can handle it
      throw error;
    } finally {
      await screenRecorder.stop();

      // 3. Discard if passed, keep if failed
      // if (testPassed && fs.existsSync(videoPath)) {
      // fs.unlinkSync(videoPath);
      // }
    }
  });

  it('should be able to publish classroom', async function () {
    await curriculumAdmin.publishClassroom('Math');
    await loggedOutUser.navigateToClassroomPage('math');
    await loggedOutUser.expectToBeOnClassroomPage('Math');
  });

  it('should be able to enable diagnostic test for a classroom', async function () {
    await curriculumAdmin.enableDiagnosticTestForClassroom('Math');
    await loggedOutUser.navigateToClassroomPage('math');
    await loggedOutUser.expectDiagnosticTestBoxToBePresent(
      'Already know some Math?',
      'Take quiz'
    );
  });

  it('should be able to change order of classrooms', async function () {
    await curriculumAdmin.createAndPublishClassroom(
      'Science',
      'science',
      'Test Topic 1'
    );
    await curriculumAdmin.clickOnElementWithText('Change Order');
    await curriculumAdmin.moveClassroomInOrder(['Science', 'Math']);
    await curriculumAdmin.clickOnElementWithText('Save');
    await curriculumAdmin.expectClassroomsInOrder(['Science', 'Math']);
  });

  it('should be able to delete a classroom', async function () {
    await curriculumAdmin.deleteClassroom('Math');
    await curriculumAdmin.expectNumberOfClassroomsToBe(1);
  });

  afterAll(async function () {
    await UserFactory.closeAllBrowsers();
  });
});
