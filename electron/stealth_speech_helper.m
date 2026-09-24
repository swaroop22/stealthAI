#import <Foundation/Foundation.h>
#import <AVFoundation/AVFoundation.h>
#import <Speech/Speech.h>

@interface StealthSpeechEngine : NSObject <SFSpeechRecognizerDelegate>
@property (nonatomic, strong) SFSpeechRecognizer *recognizer;
@property (nonatomic, strong) AVAudioEngine *audioEngine;
@property (nonatomic, strong) SFSpeechAudioBufferRecognitionRequest *currentRequest;
@property (nonatomic, strong) SFSpeechRecognitionTask *currentTask;
@property (nonatomic, assign) BOOL isRunning;
@property (nonatomic, strong) NSString *lastEmittedInterim;
@property (nonatomic, strong) NSTimer *silenceTimer;
@end

@implementation StealthSpeechEngine

- (instancetype)init {
    self = [super init];
    if (self) {
        NSLocale *locale = [NSLocale localeWithLocaleIdentifier:@"en-US"];
        self.recognizer = [[SFSpeechRecognizer alloc] initWithLocale:locale];
        self.recognizer.delegate = self;
        self.audioEngine = [[AVAudioEngine alloc] init];
        self.isRunning = NO;
        self.lastEmittedInterim = @"";
    }
    return self;
}

- (void)emitJSON:(NSDictionary *)dict {
    NSData *data = [NSJSONSerialization dataWithJSONObject:dict options:0 error:nil];
    if (data) {
        NSString *str = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        printf("%s\n", [str UTF8String]);
        fflush(stdout);
    }
}

- (void)start {
    if (self.isRunning) return;
    self.isRunning = YES;

    // Check authorization
    [SFSpeechRecognizer requestAuthorization:^(SFSpeechRecognizerAuthorizationStatus status) {
        if (status != SFSpeechRecognizerAuthorizationStatusAuthorized) {
            [self emitJSON:@{@"type": @"error", @"message": @"Speech recognition not authorized on macOS"}];
            exit(1);
        }
        dispatch_async(dispatch_get_main_queue(), ^{
            [self setupAndStartAudio];
        });
    }];
}

- (void)setupAndStartAudio {
    AVAudioInputNode *inputNode = self.audioEngine.inputNode;
    AVAudioFormat *recordingFormat = [inputNode outputFormatForBus:0];

    [inputNode removeTapOnBus:0];
    [inputNode installTapOnBus:0 bufferSize:1024 format:recordingFormat block:^(AVAudioPCMBuffer * _Nonnull buffer, AVAudioTime * _Nonnull when) {
        if (self.currentRequest) {
            [self.currentRequest appendAudioPCMBuffer:buffer];
        }
    }];

    NSError *error = nil;
    [self.audioEngine startAndReturnError:&error];
    if (error) {
        [self emitJSON:@{@"type": @"error", @"message": [NSString stringWithFormat:@"Audio Engine error: %@", error.localizedDescription]}];
        exit(1);
    }

    [self emitJSON:@{@"type": @"status", @"status": @"listening"}];
    [self startNewRecognitionTask];
}

- (void)startNewRecognitionTask {
    if (!self.isRunning) return;

    if (self.currentTask) {
        [self.currentTask cancel];
        self.currentTask = nil;
    }

    self.currentRequest = [[SFSpeechAudioBufferRecognitionRequest alloc] init];
    self.currentRequest.shouldReportPartialResults = YES;
    self.currentRequest.taskHint = SFSpeechRecognitionTaskHintDictation;
    if (@available(macOS 10.15, *)) {
        if (self.recognizer.supportsOnDeviceRecognition) {
            self.currentRequest.requiresOnDeviceRecognition = YES;
        }
    }

    __weak typeof(self) weakSelf = self;
    self.currentTask = [self.recognizer recognitionTaskWithRequest:self.currentRequest resultHandler:^(SFSpeechRecognitionResult * _Nullable result, NSError * _Nullable taskError) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (!strongSelf || !strongSelf.isRunning) return;

        if (result) {
            NSString *transcript = result.bestTranscription.formattedString;
            if (transcript.length > 0) {
                strongSelf.lastEmittedInterim = transcript;
                [strongSelf emitJSON:@{
                    @"type": result.isFinal ? @"final" : @"interim",
                    @"text": transcript
                }];

                // Reset silence timer on new partial speech
                [strongSelf.silenceTimer invalidate];
                strongSelf.silenceTimer = [NSTimer scheduledTimerWithTimeInterval:1.2 repeats:NO block:^(NSTimer * _Nonnull timer) {
                    if (strongSelf.lastEmittedInterim.length > 0) {
                        [strongSelf emitJSON:@{
                            @"type": @"final",
                            @"text": strongSelf.lastEmittedInterim
                        }];
                        strongSelf.lastEmittedInterim = @"";
                        [strongSelf restartRecognition];
                    }
                }];
            }

            if (result.isFinal) {
                [strongSelf.silenceTimer invalidate];
                strongSelf.lastEmittedInterim = @"";
                [strongSelf restartRecognition];
            }
        }

        if (taskError && strongSelf.isRunning) {
            // Auto restart on end of stream
            [strongSelf restartRecognition];
        }
    }];
}

- (void)restartRecognition {
    if (!self.isRunning) return;
    dispatch_async(dispatch_get_main_queue(), ^{
        if (self.currentRequest) {
            [self.currentRequest endAudio];
            self.currentRequest = nil;
        }
        [self startNewRecognitionTask];
    });
}

- (void)stop {
    self.isRunning = NO;
    [self.silenceTimer invalidate];
    if (self.currentRequest) {
        [self.currentRequest endAudio];
        self.currentRequest = nil;
    }
    if (self.currentTask) {
        [self.currentTask cancel];
        self.currentTask = nil;
    }
    if (self.audioEngine.isRunning) {
        [self.audioEngine.inputNode removeTapOnBus:0];
        [self.audioEngine stop];
    }
    [self emitJSON:@{@"type": @"status", @"status": @"stopped"}];
    exit(0);
}

@end

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        StealthSpeechEngine *engine = [[StealthSpeechEngine alloc] init];
        [engine start];

        // Listen for "stop" or EOF on stdin in background thread
        dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
            char buffer[256];
            while (fgets(buffer, sizeof(buffer), stdin) != NULL) {
                NSString *input = [NSString stringWithUTF8String:buffer];
                if ([input hasPrefix:@"stop"] || [input hasPrefix:@"quit"]) {
                    dispatch_async(dispatch_get_main_queue(), ^{
                        [engine stop];
                    });
                    break;
                }
            }
            dispatch_async(dispatch_get_main_queue(), ^{
                [engine stop];
            });
        });

        // Run Cocoa main runloop
        [[NSRunLoop currentRunLoop] run];
    }
    return 0;
}
